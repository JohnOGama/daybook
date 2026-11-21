import { decodeJwt } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from './create-auth.ts';
import { TEST_REDIRECT, authorizeCode, exchangeCode, registerClient, runOAuthFlow, signedInUser, testAuth } from './oauth-test-flow.ts';

describe('OAuth provider', () => {
  let auth: Auth;
  let otps: Map<string, string>;

  beforeEach(async () => {
    ({ auth, otps } = await testAuth());
  });

  it('serves authorization-server metadata with registration, PKCE S256 and the fitness scope', async () => {
    const meta = await auth.api.getOAuthServerConfig();
    expect(meta.registration_endpoint).toMatch(/\/oauth2\/register$/);
    expect(meta.code_challenge_methods_supported).toContain('S256');
    expect(meta.scopes_supported).toEqual(expect.arrayContaining(['openid', 'profile', 'offline_access', 'fitness']));
  });

  it('lets an app register itself without credentials', async () => {
    expect(await registerClient(auth)).toEqual(expect.any(String));
  });

  it('issues a JWT access token for the MCP URL with the fitness scope after sign-in and consent', async () => {
    const { accessToken, refreshToken, userId } = await runOAuthFlow(auth, otps);
    const claims = decodeJwt(accessToken);
    expect([claims.aud].flat()).toContain('http://localhost:3000/api/mcp');
    expect(claims.sub).toBe(userId);
    expect(String(claims.scope)).toContain('fitness');
    expect(refreshToken).toEqual(expect.any(String));
  });

  it('refuses to exchange a code without its PKCE verifier', async () => {
    const { cookie } = await signedInUser(auth, otps);
    const clientId = await registerClient(auth);
    const { code } = await authorizeCode(auth, { cookie, clientId, scope: 'openid fitness', resource: 'http://localhost:3000/api/mcp' });
    const response = await exchangeCode(auth, { grant_type: 'authorization_code', code, redirect_uri: TEST_REDIRECT, client_id: clientId });
    expect(response.ok).toBe(false);
  });
});
