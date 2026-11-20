import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { uptimeMonitors } from '../../../shared/db/schema.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { SpaceAccessService } from '../../spaces/index.ts';
import { RealtimeUptimeNotifier } from './uptime-notifier.ts';
import { UptimeService } from './uptime-service.ts';

describe('RealtimeUptimeNotifier', () => {
  let db: Db;
  let space: string;
  let notifier: RealtimeUptimeNotifier;
  const sent: { userIds: string[]; message: object }[] = [];

  beforeEach(async () => {
    db = await createTestDb();
    for (const user of ['u1', 'u2', 'u3']) await insertUser(db, user);
    sent.length = 0;
    const realtime = { sendToUsers: (userIds: string[], message: object) => void sent.push({ userIds, message }) };
    notifier = new RealtimeUptimeNotifier(realtime, new SpaceAccessService(db), new UptimeService(db));
    space = await insertSpace(db, 'u1', { tool: 'uptime' });
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    await db.insert(uptimeMonitors).values({ spaceId: space, userId: 'u1', name: 'API', url: 'https://api.example', kind: 'api', status: 'down' });
  });

  it('pushes the new dot to everyone who can see the space, and only the dot', async () => {
    await notifier.changed(space);
    expect(sent).toHaveLength(1);
    expect(sent[0].userIds.sort()).toEqual(['u1', 'u2']);
    expect(sent[0].message).toEqual({ type: 'uptime', spaceId: space, status: 'down' });
  });
});
