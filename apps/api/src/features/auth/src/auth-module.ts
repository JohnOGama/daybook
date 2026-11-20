import { Global, Module } from '@nestjs/common';
import { Resend } from 'resend';
import { DB, type Db } from '../../../shared/db/create-db.ts';
import { createOtpSender, createWelcomeSender } from '../../../shared/services/email-service.ts';
import { readEnv } from '../../../shared/utils/read-env.ts';
import { AuthGuard } from './auth-guard.ts';
import { AUTH, createAuth } from './create-auth.ts';

@Global()
@Module({
  providers: [
    AuthGuard,
    {
      provide: AUTH,
      inject: [DB],
      useFactory: (db: Db) => {
        const env = readEnv(['BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'RESEND_API_KEY', 'EMAIL_FROM']);
        const resend = new Resend(env.RESEND_API_KEY);
        return createAuth(db, createOtpSender(resend, env.EMAIL_FROM), {
          secret: env.BETTER_AUTH_SECRET,
          baseURL: env.BETTER_AUTH_URL,
          sendWelcome: createWelcomeSender(resend, env.EMAIL_FROM),
        });
      },
    },
  ],
  exports: [AUTH, AuthGuard],
})
export class AuthModule {}
