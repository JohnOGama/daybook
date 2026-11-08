import type { Resend } from 'resend';

type OtpType = 'email-verification' | 'forget-password' | 'sign-in' | 'change-email';

export type OtpSender = (message: { to: string; otp: string; type: OtpType }) => Promise<void>;

const SUBJECTS: Record<OtpType, string> = {
  'email-verification': 'Verify your Daybook email',
  'forget-password': 'Reset your Daybook password',
  'sign-in': 'Your Daybook sign-in code',
  'change-email': 'Confirm your new Daybook email',
};

export function createOtpSender(client: Pick<Resend, 'emails'>, from: string): OtpSender {
  return async ({ to, otp, type }) => {
    const { error } = await client.emails.send({
      from,
      to,
      subject: SUBJECTS[type],
      text: `Your Daybook code is ${otp}. It expires soon, and you can ignore this email if you didn't ask for it.`,
    });
    if (error) throw new Error(error.message);
  };
}
