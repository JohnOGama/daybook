import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { and, eq } from 'drizzle-orm';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { diagrams, spaceShares } from '../../../shared/db/schema.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { AUTH } from '../../auth/index.ts';
import { DiagramsService } from '../../diagrams/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { MESSAGE_MEMBERS, MESSAGE_SYNC, type Member } from './realtime-room.ts';
import { RealtimeService } from './realtime-service.ts';

const ORIGIN = 'http://localhost:3000';
// Users whose sessions were signed out elsewhere.
const revoked = new Set<string>();
const fakeAuth = {
  api: {
    getSession: async ({ headers }: { headers: Headers }) => {
      const id = headers.get('x-test-user');
      return id && !revoked.has(id) ? { user: { id } } : null;
    },
  },
};

describe('realtime endpoint', () => {
  let app: INestApplication;
  let db: Db;
  let realtime: RealtimeService;
  let port: number;
  let diagram: string;
  const open: WebSocket[] = [];

  beforeAll(() => {
    process.env.BETTER_AUTH_SECRET ??= 'test-secret';
    process.env.BETTER_AUTH_URL = ORIGIN;
  });

  beforeEach(async () => {
    db = await createTestDb();
    for (const user of ['u1', 'u2', 'u3']) await insertUser(db, user);
    const moduleRef = await Test.createTestingModule({
      providers: [
        RealtimeService,
        DiagramsService,
        SpaceAccessService,
        SpaceLockService,
        { provide: DB, useValue: db },
        { provide: AUTH, useValue: fakeAuth },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    realtime = app.get(RealtimeService);
    realtime.attach(app.getHttpServer());
    await app.listen(0);
    port = (app.getHttpServer().address() as { port: number }).port;
    diagram = await insertSpace(db, 'u1', { tool: 'diagram' });
  });

  afterEach(async () => {
    for (const socket of open.splice(0)) socket.terminate();
    await app.close();
  });

  const connect = (spaceId: string, headers: Record<string, string>) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/realtime/${spaceId}`, { headers: { origin: ORIGIN, ...headers } });
    open.push(socket);
    return socket;
  };
  const refusal = (socket: WebSocket) =>
    new Promise<number>((resolve, reject) => {
      socket.on('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0));
      socket.on('open', () => reject(new Error('connected')));
      socket.on('error', () => undefined);
    });
  const opened = (socket: WebSocket) => new Promise<void>((resolve, reject) => {
    socket.on('open', () => resolve());
    socket.on('unexpected-response', (_request, response) => reject(new Error(`refused ${response.statusCode}`)));
  });
  const membersOf = (socket: WebSocket) =>
    new Promise<Member[]>((resolve) => {
      socket.on('message', (data: Buffer) => {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        if (decoding.readVarUint(decoder) === MESSAGE_MEMBERS) resolve(JSON.parse(decoding.readVarString(decoder)));
      });
    });

  it('refuses with 404: no session, unknown space, someone else\'s space, a vault space', async () => {
    const vault = await insertSpace(db, 'u1', { tool: 'vault' });
    expect(await refusal(connect(diagram, {}))).toBe(404);
    expect(await refusal(connect(crypto.randomUUID(), { 'x-test-user': 'u1' }))).toBe(404);
    expect(await refusal(connect(diagram, { 'x-test-user': 'u3' }))).toBe(404);
    expect(await refusal(connect(vault, { 'x-test-user': 'u1' }))).toBe(404);
  });

  it('refuses a wrong Origin', async () => {
    expect(await refusal(connect(diagram, { 'x-test-user': 'u1', origin: 'https://evil.example' }))).toBe(403);
  });

  it('refuses a locked space without the unlock cookie and accepts it with one', async () => {
    const token = await app.get(SpaceLockService).setPassword('u1', diagram, 'hunter22');
    expect(await refusal(connect(diagram, { 'x-test-user': 'u1' }))).toBe(403);
    await opened(connect(diagram, { 'x-test-user': 'u1', cookie: `daybook_unlock_${diagram}=${token}` }));
  });

  it('a viewer connects and receives the members list including the owner', async () => {
    await insertShare(db, { spaceId: diagram, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    const owner = connect(diagram, { 'x-test-user': 'u1' });
    await opened(owner);
    const viewer = connect(diagram, { 'x-test-user': 'u2' });
    const members = await membersOf(viewer);
    expect(members.map((m) => [m.userId, m.access]).sort()).toEqual([
      ['u1', 'owner'],
      ['u2', 'view'],
    ]);
  });

  it('closes a connection whose share was removed', async () => {
    realtime.recheckMs = 50;
    await insertShare(db, { spaceId: diagram, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    const editor = connect(diagram, { 'x-test-user': 'u2' });
    await opened(editor);
    const closed = new Promise<number>((resolve) => editor.on('close', (code) => resolve(code)));
    await db.delete(spaceShares).where(and(eq(spaceShares.spaceId, diagram), eq(spaceShares.email, 'u2@example.com')));
    // 4403 tells y-websocket not to keep reconnecting.
    await expect(Promise.race([closed, new Promise((r) => setTimeout(() => r('open'), 500))])).resolves.toBe(4403);
  });

  it('closes a connection whose session was signed out elsewhere', async () => {
    realtime.recheckMs = 50;
    const owner = connect(diagram, { 'x-test-user': 'u1' });
    await opened(owner);
    const closed = new Promise<number>((resolve) => owner.on('close', (code) => resolve(code)));
    revoked.add('u1');
    try {
      await expect(Promise.race([closed, new Promise((r) => setTimeout(() => r('open'), 500))])).resolves.toBe(4403);
    } finally {
      revoked.delete('u1');
    }
  });

  it('keeps a connection open through a passing database error in the recheck', async () => {
    realtime.recheckMs = 50;
    const owner = connect(diagram, { 'x-test-user': 'u1' });
    await opened(owner);
    let closedWith: number | undefined;
    owner.on('close', (code) => {
      closedWith = code;
    });
    const access = app.get(SpaceAccessService);
    const resolve = access.resolve.bind(access);
    let failures = 0;
    access.resolve = async (...args) => {
      if (failures++ < 2) throw new Error('connection reset');
      return resolve(...args);
    };
    await new Promise((r) => setTimeout(r, 300));
    expect(closedWith).toBeUndefined();
    expect(owner.readyState).toBe(WebSocket.OPEN);
  });

  it('two real y-websocket browsers share the text, and each hears the other in the member list', async () => {
    await insertShare(db, { spaceId: diagram, ownerId: 'u1', email: 'u2@example.com', role: 'edit' });
    const browser = (user: string) => {
      const doc = new Y.Doc();
      class AsUser extends WebSocket {
        constructor(url: string, protocols?: string | string[]) {
          super(url, protocols, { headers: { origin: ORIGIN, 'x-test-user': user } });
        }
      }
      const provider = new WebsocketProvider(`ws://127.0.0.1:${port}/api/realtime`, diagram, doc, {
        WebSocketPolyfill: AsUser as unknown as typeof globalThis.WebSocket,
        disableBc: true,
      });
      let members: Member[] = [];
      provider.messageHandlers[MESSAGE_MEMBERS] = (_encoder, decoder) => {
        members = JSON.parse(decoding.readVarString(decoder));
      };
      const synced = new Promise<void>((resolve) => provider.once('sync', () => resolve()));
      return { doc, provider, synced, members: () => members };
    };
    const owner = browser('u1');
    const editor = browser('u2');
    try {
      await Promise.all([owner.synced, editor.synced]);
      owner.doc.getText('dbml').insert(0, 'Table a {}');
      editor.doc.getText('dbml').insert(0, '// note\n');
      // Both typed at the same spot at once: Yjs picks the order, but both edits survive and both browsers agree.
      const texts = () => [owner.doc.getText('dbml').toString(), editor.doc.getText('dbml').toString()];
      await expect.poll(() => texts()[0] === texts()[1] && texts()[0].length === '// note\nTable a {}'.length, { timeout: 3000 }).toBe(true);
      expect(texts()[0]).toContain('Table a {}');
      expect(texts()[0]).toContain('// note\n');
      await expect.poll(() => owner.members().map((m) => m.userId).sort(), { timeout: 3000 }).toEqual(['u1', 'u2']);
    } finally {
      owner.provider.destroy();
      editor.provider.destroy();
    }
  });

  it("an editor's change is saved to the diagrams row", async () => {
    const socket = connect(diagram, { 'x-test-user': 'u1' });
    await opened(socket);
    const doc = new Y.Doc();
    // Learn the server's document first, as a browser does, then type.
    await new Promise<void>((resolve) => {
      socket.on('message', (data: Buffer) => {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        if (decoding.readVarUint(decoder) !== MESSAGE_SYNC) return;
        const reply = encoding.createEncoder();
        encoding.writeVarUint(reply, MESSAGE_SYNC);
        if (syncProtocol.readSyncMessage(decoder, reply, doc, 'server') === syncProtocol.messageYjsSyncStep2) resolve();
        if (encoding.length(reply) > 1) socket.send(encoding.toUint8Array(reply));
      });
      const hello = encoding.createEncoder();
      encoding.writeVarUint(hello, MESSAGE_SYNC);
      syncProtocol.writeSyncStep1(hello, doc);
      socket.send(encoding.toUint8Array(hello));
    });
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'server') return;
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      socket.send(encoding.toUint8Array(encoder));
    });
    doc.getText('dbml').insert(0, 'Table live {}');
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const [row] = await db.select().from(diagrams).where(eq(diagrams.spaceId, diagram));
    expect(row.dbml).toBe('Table live {}');
  });
});
