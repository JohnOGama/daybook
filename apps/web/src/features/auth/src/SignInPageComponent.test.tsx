import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { SignInPageComponent } from './SignInPageComponent';

const { signInEmail, sendVerificationOtp, push } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  sendVerificationOtp: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/shared/services/auth-client', () => ({
  authClient: { signIn: { email: signInEmail }, emailOtp: { sendVerificationOtp } },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

async function submitSignIn(email: string, password: string) {
  render(<SignInPageComponent />);
  await userEvent.type(screen.getByLabelText('Email'), email);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

beforeEach(() => vi.clearAllMocks());

it('sends a new code and goes to the code screen for an unverified account', async () => {
  signInEmail.mockResolvedValue({ error: { status: 403, code: 'EMAIL_NOT_VERIFIED' } });
  sendVerificationOtp.mockResolvedValue({});
  await submitSignIn('a@b.c', 'password123');
  expect(sendVerificationOtp).toHaveBeenCalledWith({ email: 'a@b.c', type: 'email-verification' });
  expect(push).toHaveBeenCalledWith('/verify?email=a%40b.c');
});

it('shows the error for a wrong password and stays put', async () => {
  signInEmail.mockResolvedValue({
    error: { status: 401, code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' },
  });
  await submitSignIn('a@b.c', 'wrongpassword');
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  expect(push).not.toHaveBeenCalled();
});

it('goes to the list after signing in', async () => {
  signInEmail.mockResolvedValue({ data: { user: {} } });
  await submitSignIn('a@b.c', 'password123');
  expect(push).toHaveBeenCalledWith('/list');
});
