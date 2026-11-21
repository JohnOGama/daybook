import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { oauthAccessToken, oauthClient, oauthConsent, oauthRefreshToken } from '../../../shared/db/schema.ts';

export type ConnectedApp = { id: string; name: string; connectedAt: string; scopes: string[] };

// The AI apps a person has approved: one per consent. The plugin's own delete-consent leaves tokens behind,
// so Disconnect is Daybook's.
@Injectable()
export class ConnectedAppsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async list(userId: string): Promise<ConnectedApp[]> {
    const rows = await this.db
      .select({ id: oauthConsent.id, name: oauthClient.name, scopes: oauthConsent.scopes, createdAt: oauthConsent.createdAt, updatedAt: oauthConsent.updatedAt })
      .from(oauthConsent)
      .innerJoin(oauthClient, eq(oauthClient.clientId, oauthConsent.clientId))
      .where(eq(oauthConsent.userId, userId))
      .orderBy(desc(oauthConsent.createdAt));
    return rows.map(({ id, name, scopes, createdAt, updatedAt }) => ({
      id,
      name: name ?? 'Unnamed app',
      connectedAt: (createdAt ?? updatedAt ?? new Date(0)).toISOString(),
      scopes,
    }));
  }

  // Deletes the consent and every token the app holds for this person, so it stops at once.
  async disconnect(userId: string, id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [consent] = await tx
        .select({ clientId: oauthConsent.clientId })
        .from(oauthConsent)
        .where(and(eq(oauthConsent.id, id), eq(oauthConsent.userId, userId)));
      if (!consent) throw new NotFoundException('App not found');
      const theirs = (table: typeof oauthAccessToken | typeof oauthRefreshToken) => and(eq(table.userId, userId), eq(table.clientId, consent.clientId));
      await tx.delete(oauthAccessToken).where(theirs(oauthAccessToken));
      await tx.delete(oauthRefreshToken).where(theirs(oauthRefreshToken));
      await tx.delete(oauthConsent).where(eq(oauthConsent.id, id));
    });
  }
}
