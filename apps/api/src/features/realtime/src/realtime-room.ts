import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

type Positions = Record<string, { x: number; y: number }>;
type Access = 'owner' | 'edit' | 'view';

export type Member = { userId: string; name: string; image: string | null; access: Access; clientIds: number[] };
export type Peer = { userId: string; name: string; image: string | null; access: Access; send(data: Uint8Array): void; close(): void };
export type RoomStore = {
  load(): Promise<{ dbml: string; positions: Positions; ydoc: Uint8Array | null } | null>;
  save(doc: { dbml: string; positions: Positions; ydoc: Uint8Array }): Promise<void>;
};

export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;
export const MESSAGE_MEMBERS = 100;
export const SAVE_PAUSE_MS = 800;

// Cursors are drawn in the foreground colour, so every person gets the same one.
const CURSOR_COLOR = { color: '#e5e5e5', colorLight: 'rgb(255 255 255 / 0.14)' };

const message = (type: number, write: (encoder: encoding.Encoder) => void) => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, type);
  write(encoder);
  return encoding.toUint8Array(encoder);
};

// One open space: who is in it, their cursors, and (for a Database diagram) the shared document.
// Every room carries presence; only a live room accepts document changes, and only from people who can edit.
// ponytail: rooms live in this process's memory, so there can be only one API server; several need a shared relay
// (for example a Redis-backed Yjs provider).
export class Room {
  private readonly awareness: Awareness;
  private readonly peers = new Set<Peer>();
  private readonly owners = new Map<number, Peer>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private dirty = false;
  private saving: Promise<void> = Promise.resolve();

  private constructor(
    readonly spaceId: string,
    private readonly live: boolean,
    private readonly store: RoomStore,
    private readonly doc: Y.Doc,
  ) {
    this.awareness = new Awareness(doc);
    this.awareness.setLocalState(null);
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      const data = message(MESSAGE_SYNC, (encoder) => syncProtocol.writeUpdate(encoder, update));
      for (const peer of this.peers) if (peer !== origin) peer.send(data);
      this.dirty = true;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.flush().catch((error) => console.error('Could not save a live diagram', error)), SAVE_PAUSE_MS);
    });
    this.awareness.on('update', ({ added, updated, removed }: Record<'added' | 'updated' | 'removed', number[]>) => {
      const changed = [...added, ...updated, ...removed];
      const data = message(MESSAGE_AWARENESS, (encoder) => encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(this.awareness, changed)));
      for (const peer of this.peers) peer.send(data);
    });
  }

  static async open(spaceId: string, live: boolean, store: RoomStore): Promise<Room> {
    const doc = new Y.Doc();
    const room = new Room(spaceId, live, store, doc);
    if (!live) return room;
    const stored = await store.load();
    if (stored?.ydoc) {
      Y.applyUpdate(doc, stored.ydoc);
    } else if (stored) {
      // Built once from the text and saved straight away, so every later room starts from this same document.
      doc.transact(() => {
        doc.getText('dbml').insert(0, stored.dbml);
        for (const [name, point] of Object.entries(stored.positions)) doc.getMap('positions').set(name, point);
      });
      await room.flush();
    }
    room.dirty = false;
    clearTimeout(room.timer);
    return room;
  }

  get empty(): boolean {
    return this.peers.size === 0;
  }

  join(peer: Peer): void {
    this.peers.add(peer);
    peer.send(message(MESSAGE_SYNC, (encoder) => syncProtocol.writeSyncStep1(encoder, this.doc)));
    const known = [...this.awareness.getStates().keys()];
    if (known.length > 0) {
      peer.send(message(MESSAGE_AWARENESS, (encoder) => encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(this.awareness, known))));
    }
    this.sendMembers();
  }

  leave(peer: Peer): void {
    if (!this.peers.delete(peer)) return;
    const ids = this.idsOf(peer);
    for (const id of ids) this.owners.delete(id);
    removeAwarenessStates(this.awareness, ids, peer);
    this.sendMembers();
  }

  setAccess(peer: Peer, access: Access): void {
    peer.access = access;
    this.sendMembers();
  }

  receive(peer: Peer, data: Uint8Array): void {
    if (!this.peers.has(peer)) return;
    try {
      const decoder = decoding.createDecoder(data);
      const type = decoding.readVarUint(decoder);
      if (type === MESSAGE_SYNC) this.receiveSync(peer, decoder);
      else if (type === MESSAGE_AWARENESS) this.receiveAwareness(peer, decoding.readVarUint8Array(decoder));
    } catch {
      // A malformed message from one browser must not take the room down for everyone.
      peer.close();
    }
  }

  // Saves run one after another, and a flush waits for any save already running, so a later write can't land first
  // and nobody closes the room while its last change is still on its way to the database.
  flush(): Promise<void> {
    clearTimeout(this.timer);
    const next = this.saving.catch(() => undefined).then(() => this.saveNow());
    this.saving = next;
    return next;
  }

  private async saveNow(): Promise<void> {
    if (!this.live || !this.dirty) return;
    this.dirty = false;
    try {
      await this.store.save({
        dbml: this.doc.getText('dbml').toString(),
        positions: this.doc.getMap('positions').toJSON() as Positions,
        ydoc: Y.encodeStateAsUpdate(this.doc),
      });
    } catch (error) {
      // Still unsaved: the next change or flush tries again.
      this.dirty = true;
      throw error;
    }
  }

  close(): void {
    clearTimeout(this.timer);
    this.awareness.destroy();
    this.doc.destroy();
  }

  members(): Member[] {
    const byUser = new Map<string, Member>();
    for (const peer of this.peers) {
      const member = byUser.get(peer.userId) ?? { userId: peer.userId, name: peer.name, image: peer.image, access: peer.access, clientIds: [] };
      member.clientIds.push(...this.idsOf(peer));
      byUser.set(peer.userId, member);
    }
    return [...byUser.values()];
  }

  private receiveSync(peer: Peer, decoder: decoding.Decoder): void {
    const kind = decoding.readVarUint(decoder);
    if (kind === syncProtocol.messageYjsSyncStep1) {
      const stateVector = decoding.readVarUint8Array(decoder);
      peer.send(message(MESSAGE_SYNC, (encoder) => syncProtocol.writeSyncStep2(encoder, this.doc, stateVector)));
      return;
    }
    // Step 2 and updates both carry changes: only people who can edit a live diagram get to apply them.
    if (kind !== syncProtocol.messageYjsSyncStep2 && kind !== syncProtocol.messageYjsUpdate) return;
    const update = decoding.readVarUint8Array(decoder);
    if (!this.live || peer.access === 'view') return;
    Y.applyUpdate(this.doc, update, peer);
  }

  // Keeps only states for client ids this connection introduced, and replaces whatever name the browser put in them.
  private receiveAwareness(peer: Peer, update: Uint8Array): void {
    const decoder = decoding.createDecoder(update);
    const encoder = encoding.createEncoder();
    const count = decoding.readVarUint(decoder);
    const kept: [number, number, string][] = [];
    let claimed = false;
    for (let index = 0; index < count; index++) {
      const clientId = decoding.readVarUint(decoder);
      const clock = decoding.readVarUint(decoder);
      const state = JSON.parse(decoding.readVarString(decoder)) as Record<string, unknown> | null;
      const owner = this.owners.get(clientId);
      if (owner && owner !== peer) continue;
      if (!owner && state !== null) {
        this.owners.set(clientId, peer);
        claimed = true;
      }
      const named = state === null ? null : { ...state, user: { name: peer.name, ...CURSOR_COLOR } };
      kept.push([clientId, clock, JSON.stringify(named)]);
    }
    if (kept.length === 0) return;
    encoding.writeVarUint(encoder, kept.length);
    for (const [clientId, clock, state] of kept) {
      encoding.writeVarUint(encoder, clientId);
      encoding.writeVarUint(encoder, clock);
      encoding.writeVarString(encoder, state);
    }
    applyAwarenessUpdate(this.awareness, encoding.toUint8Array(encoder), peer);
    if (claimed) this.sendMembers();
  }

  private idsOf(peer: Peer): number[] {
    return [...this.owners].filter(([, owner]) => owner === peer).map(([id]) => id);
  }

  private sendMembers(): void {
    const data = message(MESSAGE_MEMBERS, (encoder) => encoding.writeVarString(encoder, JSON.stringify(this.members())));
    for (const peer of this.peers) peer.send(data);
  }
}
