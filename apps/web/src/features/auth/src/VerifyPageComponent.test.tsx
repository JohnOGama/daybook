import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { VerifyPageComponent } from './VerifyPageComponent';

const { verifyEmail, sendVerificationOtp, push } = vi.hoisted(() => ({
  verifyEmail: vi.fn(),
  sendVerificationOtp: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/shared/services/auth-client', () => ({
  authClient: { emailOtp: { verifyEmail, sendVerificationOtp } },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('email=a%40b.c'),
}));

async function submitCode(otp: string) {
  render(<VerifyPageComponent />);
  await userEvent.type(screen.getByLabelText('6-digit code'), otp);
  await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
}

beforeEach(() => vi.clearAllMocks());

it('shows an error for a wrong code', async () => {
  verifyEmail.mockResolvedValue({ error: { message: 'Invalid OTP' } });
  await submitCode('000000');
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid OTP');
  expect(push).not.toHaveBeenCalled();
});

it('goes to sign in after a correct code', async () => {
  verifyEmail.mockResolvedValue({ data: {} });
  await submitCode('123456');
  expect(verifyEmail).toHaveBeenCalledWith({ email: 'a@b.c', otp: '123456' });
  expect(push).toHaveBeenCalledWith('/sign-in');
});

it('Resend code sends a new code', async () => {
  sendVerificationOtp.mockResolvedValue({});
  render(<VerifyPageComponent />);
  await userEvent.click(screen.getByRole('button', { name: 'Resend code' }));
  expect(sendVerificationOtp).toHaveBeenCalledWith({ email: 'a@b.c', type: 'email-verification' });
  expect(await screen.findByText('We sent a new code.')).toBeInTheDocument();
});

it('shows an error when a new code cannot be sent', async () => {
  sendVerificationOtp.mockResolvedValue({ error: { message: 'Could not send' } });
  render(<VerifyPageComponent />);
  await userEvent.click(screen.getByRole('button', { name: 'Resend code' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not send');
});
