import { and, eq } from 'drizzle-orm';
import { createLocalJWKSet, jwtVerify } from 'jose';
import type { Db } from '../../../shared/db/create-db.ts';
import { oauthConsent } from '../../../shared/db/schema.ts';
import { type Auth, mcpUrlFor } from '../../auth/index.ts';

export type McpCaller = { userId: string; clientId: string };

export const MCP_SCOPE = 'fitness';

export async function oauthIssuer(auth: Auth): Promise<string> {
  return (await auth.api.getOAuthServerConfig()).issuer;
}

const scopesOf = (claim: unknown) => (typeof claim === 'string' ? claim.split(' ') : []);

// A JWT access token Daybook issued for /api/mcp with the fitness scope, whose consent still exists.
// The consent check is what makes Disconnect take effect before the token expires.
export async function verifyMcpToken(auth: Auth, db: Db, authorization: string | undefined): Promise<McpCaller | null> {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  if (!token) return null;
  try {
    const keys = createLocalJWKSet(await auth.api.getJwks());
    const { payload } = await jwtVerify(token, keys, {
      issuer: await oauthIssuer(auth),
      audience: mcpUrlFor(auth.options.baseURL as string),
    });
    const clientId = typeof payload.azp === 'string' ? payload.azp : payload.client_id;
    if (typeof payload.sub !== 'string' || typeof clientId !== 'string') return null;
    if (!scopesOf(payload.scope).includes(MCP_SCOPE)) return null;
    const [consent] = await db
      .select({ scopes: oauthConsent.scopes })
      .from(oauthConsent)
      .where(and(eq(oauthConsent.userId, payload.sub), eq(oauthConsent.clientId, clientId)));
    if (!consent?.scopes.includes(MCP_SCOPE)) return null;
    return { userId: payload.sub, clientId };
  } catch {
    return null;
  }
}
