import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { AuthCardComponent } from './AuthCardComponent';

const { useSession, replace } = vi.hoisted(() => ({ useSession: vi.fn(), replace: vi.fn() }));

vi.mock('@/shared/services/auth-client', () => ({ authClient: { useSession } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const renderCard = () =>
  render(
    <AuthCardComponent title="Sign in" onSubmit={() => {}}>
      <input aria-label="Email" />
    </AuthCardComponent>,
  );

beforeEach(() => vi.clearAllMocks());

it('sends someone with a valid session to their tasks and hides the form', () => {
  useSession.mockReturnValue({ data: { user: { id: 'u1' } }, isPending: false });
  renderCard();
  expect(replace).toHaveBeenCalledWith('/list');
  expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
});

it('shows the form when there is no valid session', () => {
  useSession.mockReturnValue({ data: null, isPending: false });
  renderCard();
  expect(replace).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
});

it('waits for the session check before showing the form or redirecting', () => {
  useSession.mockReturnValue({ data: null, isPending: true });
  renderCard();
  expect(replace).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument();
});
