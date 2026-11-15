import type { IncomingMessage, Server } from 'node:http';
import { STATUS_CODES } from 'node:http';
import type { Duplex } from 'node:stream';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import { type WebSocket, WebSocketServer } from 'ws';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { spaces, user } from '../../../shared/db/schema.ts';
import { AUTH, type Auth } from '../../auth/index.ts';
import { DiagramsService } from '../../diagrams/index.ts';
import { SpaceAccessService, SpaceLockService } from '../../spaces/index.ts';
import { type Peer, Room } from './realtime-room.ts';

const PATH = /^\/api\/realtime\/([^/?#]+)$/;
const MAX_MESSAGE_BYTES = 2 * 1024 * 1024;

class Refused extends Error {
  constructor(readonly status: 403 | 404) {
    super(STATUS_CODES[status]);
  }
}

function refuse(socket: Duplex, status: number): void {
  socket.write(`HTTP/1.1 ${status} ${STATUS_CODES[status]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

// The live connection for an open space: /api/realtime/<spaceId>. It is checked like loading the space
// (origin, session, access, space password) and checked again while it stays open.
@Injectable()
export class RealtimeService implements OnModuleDestroy {
  recheckMs = 60_000;
  private readonly server = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  private readonly rooms = new Map<string, Promise<Room>>();

  constructor(
    @Inject(AUTH) private readonly auth: Pick<Auth, 'api'>,
    @Inject(SpaceAccessService) private readonly access: SpaceAccessService,
    @Inject(SpaceLockService) private readonly lock: SpaceLockService,
    @Inject(DiagramsService) private readonly diagrams: DiagramsService,
    @Inject(DB) private readonly db: Db,
  ) {}

  attach(http: Server): void {
    http.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const spaceId = PATH.exec(new URL(request.url ?? '', 'http://localhost').pathname)?.[1];
      if (!spaceId) return;
      this.upgrade(request, socket, head, spaceId).catch((error) => {
        if (!(error instanceof Refused)) console.error('Realtime connection failed', error);
        refuse(socket, error instanceof Refused ? error.status : 404);
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    for (const client of this.server.clients) client.terminate();
    for (const [spaceId, room] of this.rooms) {
      this.rooms.delete(spaceId);
      const open = await room.catch(() => null);
      await open?.flush().catch((error) => console.error('Could not save a live diagram', error));
      open?.close();
    }
  }

  private async upgrade(request: IncomingMessage, socket: Duplex, head: Buffer, spaceId: string): Promise<void> {
    if (!this.trustedOrigin(request.headers.origin)) throw new Refused(403);
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) throw new Refused(404);
    const userId = session.user.id;
    const cookie = request.headers.cookie;
    const { access, ownerId } = await this.access.resolve(userId, spaceId, 'view').catch(() => {
      throw new Refused(404);
    });
    const [space] = await this.db.select({ tool: spaces.tool }).from(spaces).where(eq(spaces.id, spaceId));
    // Nobody else can ever be in a Vault, and a folder has nothing open in it.
    if (!space?.tool || space.tool === 'vault') throw new Refused(404);
    if (!(await this.lock.isOpen(userId, spaceId, cookie))) throw new Refused(403);
    const [person] = await this.db.select({ name: user.name, image: user.image }).from(user).where(eq(user.id, userId));
    const room = await this.room(spaceId, space.tool === 'diagram', ownerId);

    this.server.handleUpgrade(request, socket, head, (ws) => {
      const peer: Peer = {
        userId,
        name: person?.name ?? '',
        image: person?.image ?? null,
        access,
        send: (data) => {
          if (ws.readyState === ws.OPEN) ws.send(data);
        },
        close: () => ws.close(),
      };
      this.accept(ws, room, peer, cookie);
    });
  }

  private accept(ws: WebSocket, room: Room, peer: Peer, cookie: string | undefined): void {
    ws.on('message', (data: Buffer) => room.receive(peer, new Uint8Array(data)));
    room.join(peer);
    // Unshared, deleted, re-locked or changed to view-only while open: closed or downgraded here.
    const recheck = setInterval(async () => {
      try {
        const { access } = await this.access.resolve(peer.userId, room.spaceId, 'view');
        if (!(await this.lock.isOpen(peer.userId, room.spaceId, cookie))) throw new Refused(403);
        if (access !== peer.access) room.setAccess(peer, access);
      } catch {
        ws.close();
      }
    }, this.recheckMs);
    ws.on('close', () => {
      clearInterval(recheck);
      room.leave(peer);
      void this.release(room);
    });
  }

  private room(spaceId: string, live: boolean, ownerId: string): Promise<Room> {
    let room = this.rooms.get(spaceId);
    if (!room) {
      room = Room.open(spaceId, live, {
        load: () => this.diagrams.loadDoc(spaceId),
        save: (doc) => this.diagrams.saveDoc(ownerId, spaceId, doc),
      });
      this.rooms.set(spaceId, room);
      room.catch(() => this.rooms.delete(spaceId));
    }
    return room;
  }

  // The last person left: save, and forget the room unless someone joined while it saved.
  private async release(room: Room): Promise<void> {
    if (!room.empty) return;
    await room.flush().catch((error) => console.error('Could not save a live diagram', error));
    const current = this.rooms.get(room.spaceId);
    if (room.empty && current && (await current) === room) {
      this.rooms.delete(room.spaceId);
      room.close();
    }
  }

  private trustedOrigin(origin: string | undefined): boolean {
    const allowed = process.env.BETTER_AUTH_URL;
    if (!origin || !allowed) return false;
    try {
      return new URL(origin).origin === new URL(allowed).origin;
    } catch {
      return false;
    }
  }
}
