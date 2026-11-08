import { expect, it, vi } from 'vitest';
import { createOtpSender } from './email-service.ts';

it('rejects when Resend returns an error', async () => {
  const send = createOtpSender(
    { emails: { send: async () => ({ data: null, error: { message: 'bad' } }) } } as never,
    'a@b.c',
  );
  await expect(send({ to: 'x@y.z', otp: '123456', type: 'email-verification' })).rejects.toThrow('bad');
});

it('puts the code in the email body', async () => {
  const emailsSend = vi.fn(async () => ({ data: { id: '1' }, error: null }));
  const send = createOtpSender({ emails: { send: emailsSend } } as never, 'from@b.c');
  await send({ to: 'x@y.z', otp: '123456', type: 'forget-password' });
  const message = (emailsSend.mock.calls as unknown as [{ from: string; to: string; text: string }][])[0][0];
  expect(message).toMatchObject({ from: 'from@b.c', to: 'x@y.z' });
  expect(message.text).toContain('123456');
});
