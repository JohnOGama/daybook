import { Module } from '@nestjs/common';
import { Resend } from 'resend';
import { createInterviewReminderSender } from '../../../shared/services/email-service.ts';
import { readEnv } from '../../../shared/utils/read-env.ts';
import { BudgetModule } from '../../budget/index.ts';
import { SpacesModule } from '../../spaces/index.ts';
import { INTERVIEW_MAILER, InterviewReminderScheduler, SITE_URL } from './interview-reminders.ts';
import { JobsController } from './jobs-controller.ts';
import { JobsService } from './jobs-service.ts';

@Module({
  imports: [SpacesModule, BudgetModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    InterviewReminderScheduler,
    {
      provide: INTERVIEW_MAILER,
      useFactory: () => {
        const env = readEnv(['RESEND_API_KEY', 'EMAIL_FROM']);
        return createInterviewReminderSender(new Resend(env.RESEND_API_KEY), env.EMAIL_FROM);
      },
    },
    { provide: SITE_URL, useFactory: () => readEnv(['BETTER_AUTH_URL']).BETTER_AUTH_URL.replace(/\/$/, '') },
  ],
})
export class JobsModule {}
