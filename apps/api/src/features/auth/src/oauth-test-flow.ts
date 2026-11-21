import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../../../shared/db/create-db.ts';
import { createTestDb } from '../../../shared/db/test-db.ts';
import { type Auth, createAuth, mcpUrlFor } from './create-auth.ts';

// Test helper: a Better Auth instance on PGlite and the full OAuth dance an MCP client goes through.

export const TEST_BASE_URL = 'http://localhost:3000';
export const TEST_REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const password = 'password123';

export async function testAuth(): Promise<{ auth: Auth; db: Db; otps: Map<string, string> }> {
  const db = await createTestDb();
  const otps = new Map<string, string>();
  const auth = createAuth(db, async ({ to, otp }) => void otps.set(to, otp), {
    secret: 'test-secret-test-secret-test-secret',
    baseURL: TEST_BASE_URL,
  });
  return { auth, db, otps };
}

const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((header) => header.split(';')[0])
    .join('; ');

async function call(auth: Auth, path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.cookie) headers.set('cookie', init.cookie);
  return auth.handler(new Request(`${TEST_BASE_URL}/api/auth${path}`, { ...init, headers, redirect: 'manual' }));
}

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export async function signedInUser(auth: Auth, otps: Map<string, string>, email = 'person@example.com') {
  const { user } = await auth.api.signUpEmail({ body: { name: 'Person', email, password } });
  await auth.api.verifyEmailOTP({ body: { email, otp: otps.get(email) as string } });
  const response = await call(auth, '/sign-in/email', json({ email, password }));
  if (!response.ok) throw new Error(`sign-in failed: ${response.status}`);
  return { userId: user.id, cookie: cookieOf(response) };
}

export async function registerClient(auth: Auth, name = 'Claude'): Promise<string> {
  const response = await call(
    auth,
    '/oauth2/register',
    json({ client_name: name, redirect_uris: [TEST_REDIRECT], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }),
  );
  if (!response.ok) throw new Error(`register failed: ${response.status} ${await response.text()}`);
  return (await response.json()).client_id;
}

// Signs in, registers, authorizes with PKCE, consents and returns the authorization code.
export async function authorizeCode(
  auth: Auth,
  { cookie, clientId, scope, resource }: { cookie: string; clientId: string; scope: string; resource: string | null },
) {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: TEST_REDIRECT,
    scope,
    state: 'state-1',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  if (resource) params.set('resource', resource);
  const authorize = await call(auth, `/oauth2/authorize?${params}`, { cookie });
  const location = authorize.headers.get('location');
  if (!location) throw new Error(`authorize gave no redirect: ${authorize.status} ${await authorize.text()}`);
  let url = new URL(location, TEST_BASE_URL);
  if (url.pathname === '/oauth/consent') {
    const consent = await call(auth, '/oauth2/consent', { ...json({ accept: true, oauth_query: url.search.slice(1) }), cookie });
    if (!consent.ok) throw new Error(`consent failed: ${consent.status} ${await consent.text()}`);
    url = new URL((await consent.json()).url, TEST_BASE_URL);
  }
  const code = url.searchParams.get('code');
  if (!code) throw new Error(`no code in ${url}`);
  return { code, verifier };
}

export async function exchangeCode(auth: Auth, form: Record<string, string>) {
  return call(auth, '/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  });
}

export async function runOAuthFlow(
  auth: Auth,
  otps: Map<string, string>,
  opts: { scope?: string; resource?: string | null; email?: string; clientName?: string } = {},
) {
  const resource = opts.resource === undefined ? mcpUrlFor(TEST_BASE_URL) : opts.resource;
  const { userId, cookie } = await signedInUser(auth, otps, opts.email);
  const clientId = await registerClient(auth, opts.clientName);
  const { code, verifier } = await authorizeCode(auth, { cookie, clientId, scope: opts.scope ?? 'openid profile offline_access fitness', resource });
  const form: Record<string, string> = { grant_type: 'authorization_code', code, redirect_uri: TEST_REDIRECT, client_id: clientId, code_verifier: verifier };
  if (resource) form.resource = resource;
  const response = await exchangeCode(auth, form);
  if (!response.ok) throw new Error(`token failed: ${response.status} ${await response.text()}`);
  const tokens = await response.json();
  return { accessToken: tokens.access_token as string, refreshToken: tokens.refresh_token as string, userId, clientId, cookie };
}
