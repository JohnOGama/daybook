import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LandingPageComponent } from './LandingPageComponent';

const session = vi.hoisted(() => ({ data: null as object | null }));
vi.mock('@/shared/services/auth-client', () => ({ authClient: { useSession: () => session } }));

describe('LandingPageComponent', () => {
  it('offers a dashboard link instead of sign in when signed in', () => {
    session.data = { user: {} };
    render(<LandingPageComponent />);
    expect(screen.getAllByRole('link', { name: 'Dashboard' })[0]).toHaveAttribute('href', '/list');
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    session.data = null;
  });

  it('links to sign in and the repository', () => {
    render(<LandingPageComponent />);
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/sign-in');
    expect(screen.getAllByRole('link', { name: /Star on GitHub/ })[0]).toHaveAttribute('href', expect.stringContaining('github.com'));
  });
});
