import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Auth } from '../../auth/index.ts';
import { testAuth } from '../../auth/src/oauth-test-flow.ts';
import { mountWellKnown } from './well-known.ts';

describe('mountWellKnown', () => {
  let auth: Auth;
  let app: express.Express;

  beforeEach(async () => {
    ({ auth } = await testAuth());
    app = express();
    mountWellKnown(app, auth);
  });

  it('describes /api/mcp as a protected resource, at the root and at its path form', async () => {
    const { issuer } = await auth.api.getOAuthServerConfig();
    const expected = {
      resource: 'http://localhost:3000/api/mcp',
      authorization_servers: [issuer],
      scopes_supported: ['fitness'],
      bearer_methods_supported: ['header'],
    };
    for (const path of ['/.well-known/oauth-protected-resource/api/mcp', '/.well-known/oauth-protected-resource']) {
      const response = await request(app).get(path);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(expected);
    }
  });

  it('serves the authorization-server metadata at the root and with the issuer path appended', async () => {
    const { issuer } = await auth.api.getOAuthServerConfig();
    const issuerPath = new URL(issuer).pathname.replace(/\/$/, '');
    for (const path of ['/.well-known/oauth-authorization-server', `/.well-known/oauth-authorization-server${issuerPath}`, '/.well-known/openid-configuration']) {
      const response = await request(app).get(path);
      expect(response.status, path).toBe(200);
      expect(response.body.authorization_endpoint).toEqual(expect.any(String));
      expect(response.body.registration_endpoint).toEqual(expect.any(String));
    }
  });
});
