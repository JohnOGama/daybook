import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import { oauthConsent } from '../../../shared/db/schema.ts';
import type { Auth } from '../../auth/index.ts';
import { runOAuthFlow, testAuth } from '../../auth/src/oauth-test-flow.ts';
import { verifyMcpToken } from './mcp-auth.ts';

describe('verifyMcpToken', () => {
  let auth: Auth;
  let db: Db;
  let otps: Map<string, string>;

  beforeEach(async () => {
    ({ auth, db, otps } = await testAuth());
  });

  const mint = async (payload: Record<string, unknown>) => (await auth.api.signJWT({ body: { payload } })).token;

  it('accepts a real access token and names its user and app', async () => {
    const { accessToken, userId, clientId } = await runOAuthFlow(auth, otps);
    expect(await verifyMcpToken(auth, db, `Bearer ${accessToken}`)).toEqual({ userId, clientId });
  });

  it('refuses a missing, non-Bearer or malformed header', async () => {
    expect(await verifyMcpToken(auth, db, undefined)).toBeNull();
    expect(await verifyMcpToken(auth, db, 'Basic abc')).toBeNull();
    expect(await verifyMcpToken(auth, db, 'Bearer nope')).toBeNull();
  });

  it('refuses a token without the fitness scope', async () => {
    const { accessToken } = await runOAuthFlow(auth, otps, { scope: 'openid offline_access' });
    expect(await verifyMcpToken(auth, db, `Bearer ${accessToken}`)).toBeNull();
  });

  it('refuses a token for another audience, and an expired one', async () => {
    const { userId, clientId } = await runOAuthFlow(auth, otps);
    const { issuer } = await auth.api.getOAuthServerConfig();
    const elsewhere = await mint({ iss: issuer, sub: userId, azp: clientId, scope: 'fitness', aud: 'https://elsewhere.example' });
    expect(await verifyMcpToken(auth, db, `Bearer ${elsewhere}`)).toBeNull();
    const past = Math.floor(Date.now() / 1000) - 60;
    const expired = await mint({ iss: issuer, sub: userId, azp: clientId, scope: 'fitness', aud: 'http://localhost:3000/api/mcp', iat: past - 3600, exp: past });
    expect(await verifyMcpToken(auth, db, `Bearer ${expired}`)).toBeNull();
  });

  it('refuses a token once its consent is gone', async () => {
    const { accessToken } = await runOAuthFlow(auth, otps);
    await db.delete(oauthConsent);
    expect(await verifyMcpToken(auth, db, `Bearer ${accessToken}`)).toBeNull();
  });

  it('accepts a token issued without a resource parameter', async () => {
    const { accessToken, userId, clientId } = await runOAuthFlow(auth, otps, { resource: null });
    expect(await verifyMcpToken(auth, db, `Bearer ${accessToken}`)).toEqual({ userId, clientId });
  });
});
