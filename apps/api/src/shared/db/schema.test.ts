import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { tasks } from './schema.ts';
import { createTestDb, insertSpace, insertUser } from './test-db.ts';
import type { Db } from './create-db.ts';

describe('tasks table', () => {
  let db: Db;
  let spaceId: string;

  beforeEach(async () => {
    db = await createTestDb();
    await insertUser(db, 'u1');
    spaceId = await insertSpace(db, 'u1');
  });

  it('rejects a top-level task with no day', async () => {
    await expect(
      db.insert(tasks).values({ userId: 'u1', spaceId, title: 'x', plannedDay: null }),
    ).rejects.toThrow();
  });

  it('rejects a subtask with a day', async () => {
    const [parent] = await db
      .insert(tasks)
      .values({ userId: 'u1', spaceId, title: 'p', plannedDay: '2026-11-09' })
      .returning();
    await expect(
      db.insert(tasks).values({
        userId: 'u1', spaceId,
        title: 's',
        parentId: parent.id,
        plannedDay: '2026-11-09',
      }),
    ).rejects.toThrow();
  });

  it('deleting a parent deletes its subtasks', async () => {
    const [parent] = await db
      .insert(tasks)
      .values({ userId: 'u1', spaceId, title: 'p', plannedDay: '2026-11-09' })
      .returning();
    await db.insert(tasks).values({ userId: 'u1', spaceId, title: 's', parentId: parent.id });
    await db.delete(tasks).where(eq(tasks.id, parent.id));
    expect(await db.select().from(tasks)).toHaveLength(0);
  });
});
