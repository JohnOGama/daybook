import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { SignInPageComponent } from './SignInPageComponent';

const { signInEmail, sendVerificationOtp, push, leaveFor } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  sendVerificationOtp: vi.fn(),
  push: vi.fn(),
  leaveFor: vi.fn(),
}));

vi.mock('@/shared/services/auth-client', () => ({
  authClient: {
    signIn: { email: signInEmail },
    emailOtp: { sendVerificationOtp },
    useSession: () => ({ data: null, isPending: false }),
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('./oauth-request', async (original) => ({ ...(await original<typeof import('./oauth-request')>()), leaveFor }));

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

it('continues to the waiting app after sign-in', async () => {
  signInEmail.mockResolvedValue({ data: { redirect: true, url: 'https://claude.ai/api/mcp/auth_callback?code=abc' }, error: null });
  await submitSignIn('a@b.c', 'password123');
  expect(leaveFor).toHaveBeenCalledWith('https://claude.ai/api/mcp/auth_callback?code=abc');
  expect(push).not.toHaveBeenCalled();
});

it('signs in to the app as before when no app is waiting', async () => {
  signInEmail.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  await submitSignIn('a@b.c', 'password123');
  expect(push).toHaveBeenCalledWith('/list');
  expect(leaveFor).not.toHaveBeenCalled();
});

it('keeps the waiting app’s query when an unverified account goes to the code screen', async () => {
  window.history.pushState({}, '', '/sign-in?client_id=c1&sig=abc');
  signInEmail.mockResolvedValue({ error: { status: 403, code: 'EMAIL_NOT_VERIFIED' } });
  sendVerificationOtp.mockResolvedValue({});
  await submitSignIn('a@b.c', 'password123');
  expect(push).toHaveBeenCalledWith('/verify?email=a%40b.c&client_id=c1&sig=abc');
  window.history.pushState({}, '', '/');
});
