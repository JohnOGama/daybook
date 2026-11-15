import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { spaceShares } from '../../../shared/db/schema.ts';
import { createTestDb, insertShare, insertSpace, insertUser } from '../../../shared/db/test-db.ts';
import { SpaceAccessService } from '../../spaces/index.ts';
import { reportSchema } from './pipelines-schemas.ts';
import { PipelinesService } from './pipelines-service.ts';
import { RealtimePipelinesNotifier } from './pipelines-notifier.ts';

describe('RealtimePipelinesNotifier', () => {
  let db: Db;
  let space: string;
  let pipelines: PipelinesService;
  let notifier: RealtimePipelinesNotifier;
  const sent: { userIds: string[]; message: object }[] = [];

  beforeEach(async () => {
    db = await createTestDb();
    for (const user of ['u1', 'u2', 'u3']) await insertUser(db, user);
    sent.length = 0;
    pipelines = new PipelinesService(db);
    const realtime = { sendToUsers: (userIds: string[], message: object) => void sent.push({ userIds, message }) };
    notifier = new RealtimePipelinesNotifier(realtime, new SpaceAccessService(db), pipelines);
    space = await insertSpace(db, 'u1', { tool: 'pipelines' });
    await insertShare(db, { spaceId: space, ownerId: 'u1', email: 'u2@example.com', role: 'view' });
    await pipelines.report('u1', space, reportSchema.parse({ job: 'api', run: 1, stage: 'Build', status: 'started' }));
  });

  it('sends the new status to the owner and share recipients, never to anyone else', async () => {
    await notifier.changed(space);
    expect(sent).toHaveLength(1);
    expect(sent[0].userIds.sort()).toEqual(['u1', 'u2']);
  });

  it('the push carries only type, spaceId and status', async () => {
    await notifier.changed(space);
    expect(Object.keys(sent[0].message).sort()).toEqual(['spaceId', 'status', 'type']);
    expect(sent[0].message).toEqual({ type: 'pipeline', spaceId: space, status: 'running' });
  });

  it('push skips a user whose share was removed', async () => {
    await db.delete(spaceShares).where(and(eq(spaceShares.spaceId, space), eq(spaceShares.email, 'u2@example.com')));
    await notifier.changed(space);
    expect(sent[0].userIds).toEqual(['u1']);
  });
});
