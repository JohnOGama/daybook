import { beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../../../shared/db/create-db.ts';
import type { Auth } from '../../auth/index.ts';
import { TEST_REDIRECT, exchangeCode, runOAuthFlow, testAuth } from '../../auth/src/oauth-test-flow.ts';
import { ConnectedAppsService } from './connected-apps-service.ts';
import { verifyMcpToken } from './mcp-auth.ts';

describe('ConnectedAppsService', () => {
  let auth: Auth;
  let db: Db;
  let otps: Map<string, string>;
  let apps: ConnectedAppsService;

  beforeEach(async () => {
    ({ auth, db, otps } = await testAuth());
    apps = new ConnectedAppsService(db);
  });

  it('lists the apps a person has connected, with name, scopes and when', async () => {
    const { userId } = await runOAuthFlow(auth, otps);
    expect(await apps.list(userId)).toEqual([
      { id: expect.any(String), name: 'Claude', connectedAt: expect.any(String), scopes: expect.arrayContaining(['fitness', 'offline_access']) },
    ]);
  });

  it("refuses the app's token and refresh token after Disconnect", async () => {
    const { userId, clientId, accessToken, refreshToken } = await runOAuthFlow(auth, otps);
    const refresh = (token: string) => exchangeCode(auth, { grant_type: 'refresh_token', refresh_token: token, client_id: clientId, redirect_uri: TEST_REDIRECT });
    const beforeDisconnect = await refresh(refreshToken);
    expect(beforeDisconnect.ok).toBe(true);
    const { refresh_token: rotated } = await beforeDisconnect.json();
    const [app] = await apps.list(userId);
    await apps.disconnect(userId, app.id);
    expect(await apps.list(userId)).toEqual([]);
    expect(await verifyMcpToken(auth, db, `Bearer ${accessToken}`)).toBeNull();
    expect((await refresh(rotated)).ok).toBe(false);
  });

  it("leaves other people's apps alone", async () => {
    const { userId } = await runOAuthFlow(auth, otps);
    const { userId: stranger } = await runOAuthFlow(auth, otps, { email: 'stranger@example.com', clientName: 'ChatGPT' });
    const [mine] = await apps.list(userId);
    await expect(apps.disconnect(stranger, mine.id)).rejects.toThrow('App not found');
    expect(await apps.list(userId)).toHaveLength(1);
  });
});
