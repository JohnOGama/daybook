import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import type { Db } from '../../../shared/db/create-db.ts';
import * as schema from '../../../shared/db/schema.ts';
import type { OtpSender } from '../../../shared/services/email-service.ts';

export const AUTH = Symbol('AUTH');

export function createAuth(
  db: Db,
  sendOtp: OtpSender,
  config: { secret: string; baseURL: string },
) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: [config.baseURL],
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-up/email' || typeof ctx.body?.email !== 'string') return;
        const existing = await ctx.context.internalAdapter.findUserByEmail(ctx.body.email.toLowerCase());
        if (existing && !existing.user.emailVerified) {
          await ctx.context.internalAdapter.deleteUser(existing.user.id);
        }
      }),
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        sendVerificationOTP: ({ email, otp, type }) => sendOtp({ to: email, otp, type }),
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
