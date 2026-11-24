import { Inject, Injectable } from '@nestjs/common';
import { and, asc, between, eq } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { focusSessions, focusSettings } from '../../../shared/db/schema.ts';
import { DEFAULT_SETTINGS, type FocusSettings, type SessionInput } from './focus-schemas.ts';

export type FocusSessionDto = { id: string; day: string; startedAt: string; minutes: number; taskId: string | null; taskTitle: string | null };
export type FocusView = { settings: FocusSettings; sessions: FocusSessionDto[] };

// Callers resolve access first and pass the space owner's id; every query here is scoped to it.
@Injectable()
export class FocusService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async load(ownerId: string, spaceId: string, from: string, to: string): Promise<FocusView> {
    const [settings] = await this.db
      .select({
        focusMinutes: focusSettings.focusMinutes,
        shortBreakMinutes: focusSettings.shortBreakMinutes,
        longBreakMinutes: focusSettings.longBreakMinutes,
        longBreakEvery: focusSettings.longBreakEvery,
      })
      .from(focusSettings)
      .where(and(eq(focusSettings.spaceId, spaceId), eq(focusSettings.userId, ownerId)));
    const rows = await this.db
      .select()
      .from(focusSessions)
      .where(and(eq(focusSessions.spaceId, spaceId), eq(focusSessions.userId, ownerId), between(focusSessions.day, from, to)))
      .orderBy(asc(focusSessions.startedAt));
    const sessions = rows.map(({ id, day, startedAt, minutes, taskId, taskTitle }) => ({ id, day, startedAt: startedAt.toISOString(), minutes, taskId, taskTitle }));
    return { settings: settings ?? DEFAULT_SETTINGS, sessions };
  }

  async saveSettings(ownerId: string, spaceId: string, settings: FocusSettings): Promise<void> {
    await this.db
      .insert(focusSettings)
      .values({ spaceId, userId: ownerId, ...settings })
      .onConflictDoUpdate({ target: focusSettings.spaceId, set: settings });
  }

  // The id comes from the browser, so a repeat (a retry, or a second open tab finishing the same session) is ignored.
  async addSession(ownerId: string, spaceId: string, { startedAt, ...session }: SessionInput): Promise<void> {
    await this.db
      .insert(focusSessions)
      .values({ ...session, startedAt: new Date(startedAt), spaceId, userId: ownerId })
      .onConflictDoNothing({ target: focusSessions.id });
  }
}
