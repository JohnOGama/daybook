import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { MESSAGE_AWARENESS, MESSAGE_MEMBERS, MESSAGE_SYNC, type Member, type Peer, Room, type RoomStore, SAVE_PAUSE_MS } from './realtime-room.ts';

type Saved = Parameters<RoomStore['save']>[0];
const FROM_SERVER = 'server';

function memoryStore(initial: { dbml: string; positions: Record<string, { x: number; y: number }>; ydoc: Uint8Array | null }) {
  const saves: Saved[] = [];
  let current = initial;
  const store: RoomStore = {
    load: async () => current,
    save: async (doc) => {
      saves.push(doc);
      current = doc;
    },
  };
  return { store, saves };
}

// A browser: its own Y.Doc and Awareness, wired to the room the way y-websocket wires them.
function connect(room: Room, who: { userId: string; name?: string; access: Member['access'] }, doc = new Y.Doc()) {
  const awareness = new Awareness(doc);
  const received: Uint8Array[] = [];
  let members: Member[] = [];
  const peer: Peer = {
    userId: who.userId,
    name: who.name ?? who.userId,
    image: null,
    access: who.access,
    close: vi.fn(),
    send(data) {
      received.push(data);
      const decoder = decoding.createDecoder(data);
      const type = decoding.readVarUint(decoder);
      if (type === MESSAGE_SYNC) {
        const reply = encoding.createEncoder();
        encoding.writeVarUint(reply, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, reply, doc, FROM_SERVER);
        if (encoding.length(reply) > 1) room.receive(peer, encoding.toUint8Array(reply));
      } else if (type === MESSAGE_AWARENESS) {
        applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), FROM_SERVER);
      } else if (type === MESSAGE_MEMBERS) {
        members = JSON.parse(decoding.readVarString(decoder));
      }
    },
  };
  doc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === FROM_SERVER) return;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    room.receive(peer, encoding.toUint8Array(encoder));
  });
  // One sending awareness per client id, so clocks rise the way a real browser's do.
  const senders = new Map<number, Awareness>();
  const sendAwareness = (state: Record<string, unknown>, clientId = doc.clientID) => {
    let sender = senders.get(clientId);
    if (!sender) {
      sender = new Awareness(new Y.Doc());
      sender.clientID = clientId;
      sender.setLocalState({});
      senders.set(clientId, sender);
    }
    sender.setLocalState(state);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(encoder, encodeAwarenessUpdate(sender, [clientId]));
    room.receive(peer, encoding.toUint8Array(encoder));
  };
  room.join(peer);
  // The browser starts the sync too: it sends step 1 and gets the server's state back.
  const hello = encoding.createEncoder();
  encoding.writeVarUint(hello, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(hello, doc);
  room.receive(peer, encoding.toUint8Array(hello));
  return { peer, doc, awareness, received, sendAwareness, members: () => members };
}

// A crafted message a modified browser could send: an update without going through its own doc.
function rawUpdate(kind: 'step2' | 'update', text: string) {
  const source = new Y.Doc();
  source.getText('dbml').insert(0, text);
  const update = Y.encodeStateAsUpdate(source);
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  encoding.writeVarUint(encoder, kind === 'step2' ? syncProtocol.messageYjsSyncStep2 : syncProtocol.messageYjsUpdate);
  encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

describe('Room', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('seeds a live room from text and positions when there is no ydoc, and stores the seeded ydoc at once', async () => {
    const { store, saves } = memoryStore({ dbml: 'Table a {}', positions: { a: { x: 1, y: 2 } }, ydoc: null });
    const room = await Room.open('s1', true, store);
    const client = connect(room, { userId: 'u1', access: 'owner' });
    expect(client.doc.getText('dbml').toString()).toBe('Table a {}');
    expect(client.doc.getMap('positions').toJSON()).toEqual({ a: { x: 1, y: 2 } });
    expect(saves).toHaveLength(1);
    expect(saves[0].ydoc).toBeInstanceOf(Uint8Array);
  });

  it("an editor's update reaches the other peer and is saved after 800 ms", async () => {
    const { store, saves } = memoryStore({ dbml: '', positions: {}, ydoc: null });
    const room = await Room.open('s1', true, store);
    saves.length = 0;
    const editor = connect(room, { userId: 'u2', access: 'edit' });
    const other = connect(room, { userId: 'u1', access: 'owner' });
    editor.doc.getText('dbml').insert(0, 'Table b {}');
    expect(other.doc.getText('dbml').toString()).toBe('Table b {}');
    vi.advanceTimersByTime(SAVE_PAUSE_MS - 1);
    expect(saves).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(saves).toHaveLength(1);
    expect(saves[0].dbml).toBe('Table b {}');
  });

  it('drops document updates from a viewer', async () => {
    const { store, saves } = memoryStore({ dbml: 'Table a {}', positions: {}, ydoc: null });
    const room = await Room.open('s1', true, store);
    saves.length = 0;
    const owner = connect(room, { userId: 'u1', access: 'owner' });
    const viewer = connect(room, { userId: 'u2', access: 'view' });
    const before = owner.received.length;
    room.receive(viewer.peer, rawUpdate('step2', 'evil'));
    room.receive(viewer.peer, rawUpdate('update', 'evil'));
    viewer.doc.getText('dbml').insert(0, 'evil');
    await vi.advanceTimersByTimeAsync(SAVE_PAUSE_MS * 2);
    expect(owner.received.length).toBe(before);
    expect(owner.doc.getText('dbml').toString()).toBe('Table a {}');
    expect(saves).toHaveLength(0);
  });

  it('drops document updates in a room that is not live', async () => {
    const { store, saves } = memoryStore({ dbml: '', positions: {}, ydoc: null });
    const room = await Room.open('s1', false, store);
    const a = connect(room, { userId: 'u1', access: 'owner' });
    const b = connect(room, { userId: 'u2', access: 'edit' });
    a.doc.getText('dbml').insert(0, 'Table x {}');
    room.receive(a.peer, rawUpdate('update', 'more'));
    await vi.advanceTimersByTimeAsync(SAVE_PAUSE_MS * 2);
    expect(b.doc.getText('dbml').toString()).toBe('');
    expect(saves).toHaveLength(0);
  });

  it("rewrites awareness user to the server's identity", async () => {
    const room = await Room.open('s1', false, memoryStore({ dbml: '', positions: {}, ydoc: null }).store);
    const mallory = connect(room, { userId: 'u2', name: 'Real Name', access: 'edit' });
    const other = connect(room, { userId: 'u1', access: 'owner' });
    mallory.sendAwareness({ user: { name: 'Mallory' }, cursor: { x: 1, y: 2 } });
    const state = other.awareness.getStates().get(mallory.doc.clientID);
    expect(state?.user.name).toBe('Real Name');
    expect(state?.cursor).toEqual({ x: 1, y: 2 });
  });

  it('ignores awareness for a client id owned by another connection', async () => {
    const room = await Room.open('s1', false, memoryStore({ dbml: '', positions: {}, ydoc: null }).store);
    const jane = connect(room, { userId: 'u1', name: 'Jane', access: 'owner' });
    const mallory = connect(room, { userId: 'u2', access: 'edit' });
    const watcher = connect(room, { userId: 'u3', access: 'view' });
    jane.sendAwareness({ cursor: { x: 5, y: 5 } });
    // Twice, so the forged clock is ahead of Jane's and only the ownership check can stop it.
    mallory.sendAwareness({ cursor: { x: 98, y: 98 } }, jane.doc.clientID);
    mallory.sendAwareness({ cursor: { x: 99, y: 99 } }, jane.doc.clientID);
    expect(watcher.awareness.getStates().get(jane.doc.clientID)?.cursor).toEqual({ x: 5, y: 5 });
    expect(watcher.members().find((m) => m.userId === 'u2')?.clientIds).not.toContain(jane.doc.clientID);
  });

  it('members lists each user once, with every client id', async () => {
    const room = await Room.open('s1', false, memoryStore({ dbml: '', positions: {}, ydoc: null }).store);
    const tab1 = connect(room, { userId: 'u1', access: 'owner' });
    const tab2 = connect(room, { userId: 'u1', access: 'owner' });
    const watcher = connect(room, { userId: 'u2', access: 'view' });
    tab1.sendAwareness({ cursor: null });
    tab2.sendAwareness({ cursor: null });
    const mine = watcher.members().filter((m) => m.userId === 'u1');
    expect(mine).toHaveLength(1);
    expect(mine[0].clientIds.sort()).toEqual([tab1.doc.clientID, tab2.doc.clientID].sort());
    room.leave(tab1.peer);
    expect(watcher.members().find((m) => m.userId === 'u1')?.clientIds).toEqual([tab2.doc.clientID]);
    expect(watcher.awareness.getStates().has(tab1.doc.clientID)).toBe(false);
  });

  it('reopened room merges an old client copy without duplicating', async () => {
    const { store } = memoryStore({ dbml: 'Table a {}', positions: {}, ydoc: null });
    const first = await Room.open('s1', true, store);
    const client = connect(first, { userId: 'u1', access: 'owner' });
    client.doc.getText('dbml').insert(client.doc.getText('dbml').length, '\nTable b {}');
    first.leave(client.peer);
    await first.flush();
    const second = await Room.open('s1', true, store);
    connect(second, { userId: 'u1', access: 'owner' }, client.doc);
    expect(client.doc.getText('dbml').toString()).toBe('Table a {}\nTable b {}');
    const fresh = connect(second, { userId: 'u2', access: 'view' });
    expect(fresh.doc.getText('dbml').toString()).toBe('Table a {}\nTable b {}');
  });

  it('flush saves pending rooms', async () => {
    const { store, saves } = memoryStore({ dbml: '', positions: {}, ydoc: null });
    const room = await Room.open('s1', true, store);
    saves.length = 0;
    const client = connect(room, { userId: 'u1', access: 'owner' });
    client.doc.getMap('positions').set('a', { x: 3, y: 4 });
    await room.flush();
    expect(saves).toHaveLength(1);
    expect(saves[0].positions).toEqual({ a: { x: 3, y: 4 } });
  });
});
