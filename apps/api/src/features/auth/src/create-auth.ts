import { betterAuth } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, jwt } from 'better-auth/plugins';
import { oauthProvider } from '@better-auth/oauth-provider';
import type { Db } from '../../../shared/db/create-db.ts';
import * as schema from '../../../shared/db/schema.ts';
import type { OtpSender, WelcomeSender } from '../../../shared/services/email-service.ts';

export const AUTH = Symbol('AUTH');

// The MCP endpoint, and the audience of every access token Daybook issues to an AI app.
export const mcpUrlFor = (baseURL: string) => new URL('/api/mcp', baseURL).href;

const OAUTH_SCOPES = ['openid', 'profile', 'offline_access', 'fitness'];

export function createAuth(
  db: Db,
  sendOtp: OtpSender,
  config: { secret: string; baseURL: string; sendWelcome?: WelcomeSender },
) {
  return betterAuth({
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: [config.baseURL],
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: {
      afterEmailVerification: async (user) => {
        // A failed welcome email must never undo a verified account.
        await config.sendWelcome?.({ to: user.email, name: user.name }).catch(() => {});
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // An app that leaves out `resource` would get an opaque token /api/mcp can't check, so it means the MCP URL.
        if (ctx.path === '/oauth2/authorize' && ctx.query && !ctx.query.resource) {
          return { context: { query: { ...ctx.query, resource: mcpUrlFor(config.baseURL) } } };
        }
        if (ctx.path === '/oauth2/token' && ctx.body && !ctx.body.resource) {
          return { context: { body: { ...ctx.body, resource: mcpUrlFor(config.baseURL) } } };
        }
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
      jwt(),
      oauthProvider({
        loginPage: '/sign-in',
        consentPage: '/oauth/consent',
        scopes: OAUTH_SCOPES,
        clientRegistrationDefaultScopes: OAUTH_SCOPES,
        clientRegistrationAllowedScopes: OAUTH_SCOPES,
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
        clientRegistrationRequirePKCE: true,
        resources: [mcpUrlFor(config.baseURL)],
        clientRegistrationDefaultResources: [mcpUrlFor(config.baseURL)],
        accessTokenExpiresIn: 3600,
        refreshTokenExpiresIn: 30 * 24 * 3600,
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
