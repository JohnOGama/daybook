import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../../../shared/db/test-db.ts';
import type { OtpSender } from '../../../shared/services/email-service.ts';
import { createAuth } from './create-auth.ts';

const email = 'person@example.com';
const password = 'password123';

describe('createAuth', () => {
  let sent: Parameters<OtpSender>[0][];
  let auth: ReturnType<typeof createAuth>;

  const signUp = () =>
    auth.api.signUpEmail({ body: { name: 'Person', email, password } });
  const signIn = (pw = password) =>
    auth.api.signInEmail({ body: { email, password: pw } });

  beforeEach(async () => {
    sent = [];
    auth = createAuth(await createTestDb(), async (message) => void sent.push(message), {
      secret: 'test-secret-test-secret-test-secret',
      baseURL: 'http://localhost:3000',
    });
  });

  it('emails a 6-digit code on sign-up', async () => {
    await signUp();
    expect(sent[0].type).toBe('email-verification');
    expect(sent[0].otp).toMatch(/^\d{6}$/);
  });

  it('sends a welcome email once the email is verified, and a failure there does not block verifying', async () => {
    const welcomed: string[] = [];
    const build = async (sendWelcome: (m: { to: string; name: string }) => Promise<void>) =>
      createAuth(await createTestDb(), async (message) => void sent.push(message), {
        secret: 'test-secret-test-secret-test-secret',
        baseURL: 'http://localhost:3000',
        sendWelcome,
      });

    auth = await build(async ({ to }) => void welcomed.push(to));
    await signUp();
    expect(welcomed).toEqual([]);
    await auth.api.verifyEmailOTP({ body: { email, otp: sent[0].otp } });
    expect(welcomed).toEqual([email]);

    auth = await build(async () => {
      throw new Error('resend down');
    });
    await signUp();
    await auth.api.verifyEmailOTP({ body: { email, otp: sent.at(-1)!.otp } });
    await expect(signIn()).resolves.toMatchObject({ user: { email } });
  });

  it('refuses sign-in until the email is verified', async () => {
    await signUp();
    await expect(signIn()).rejects.toMatchObject({ statusCode: 403 });
  });

  it('refuses a wrong code', async () => {
    await signUp();
    const wrong = sent[0].otp === '000000' ? '111111' : '000000';
    await expect(auth.api.verifyEmailOTP({ body: { email, otp: wrong } })).rejects.toBeDefined();
  });

  it('allows sign-in after verifying', async () => {
    await signUp();
    await auth.api.verifyEmailOTP({ body: { email, otp: sent[0].otp } });
    await expect(signIn()).resolves.toMatchObject({ user: { email } });
  });

  it('signing up again on an unverified email sends a new code and uses the new password', async () => {
    await signUp();
    await auth.api.signUpEmail({ body: { name: 'Person', email, password: 'secondpassword' } });
    expect(sent).toHaveLength(2);
    await auth.api.verifyEmailOTP({ body: { email, otp: sent[1].otp } });
    await expect(signIn('secondpassword')).resolves.toMatchObject({ user: { email } });
    await expect(signIn()).rejects.toBeDefined();
  });

  it('signing up again on a verified email leaves the account alone', async () => {
    await signUp();
    await auth.api.verifyEmailOTP({ body: { email, otp: sent[0].otp } });
    await auth.api.signUpEmail({ body: { name: 'Other', email, password: 'attackerpassword' } }).catch(() => {});
    await expect(signIn()).resolves.toMatchObject({ user: { email } });
    await expect(signIn('attackerpassword')).rejects.toBeDefined();
  });

  it('resets a password with a forget-password code, and the new password signs in', async () => {
    await signUp();
    await auth.api.verifyEmailOTP({ body: { email, otp: sent[0].otp } });
    await auth.api.sendVerificationOTP({ body: { email, type: 'forget-password' } });
    const code = sent.at(-1)!;
    expect(code.type).toBe('forget-password');
    await auth.api.resetPasswordEmailOTP({ body: { email, otp: code.otp, password: 'newpassword456' } });
    await expect(signIn('newpassword456')).resolves.toMatchObject({ user: { email } });
    await expect(signIn()).rejects.toBeDefined();
  });
});
