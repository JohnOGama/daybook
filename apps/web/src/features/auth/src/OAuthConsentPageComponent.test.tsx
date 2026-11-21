import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { OAuthConsentPageComponent } from './OAuthConsentPageComponent';

const { publicClient, consent, leaveFor, replace, search } = vi.hoisted(() => ({
  publicClient: vi.fn(),
  consent: vi.fn(),
  leaveFor: vi.fn(),
  replace: vi.fn(),
  search: { value: '' },
}));

vi.mock('@/shared/services/auth-client', () => ({
  authClient: {
    oauth2: { publicClient, consent },
    useSession: () => ({ data: { user: { id: 'u1' } }, isPending: false }),
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search.value),
}));
vi.mock('./oauth-request', () => ({ leaveFor, appIsWaiting: () => true }));

const back = 'https://claude.ai/api/mcp/auth_callback?code=abc';

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <OAuthConsentPageComponent />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  search.value = 'client_id=client-1&scope=openid+fitness&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&sig=abc';
  publicClient.mockResolvedValue({ data: { client_id: 'client-1', client_name: 'Claude' }, error: null });
  consent.mockResolvedValue({ data: { redirect: true, url: back }, error: null });
});

it('names the app and says what it may do, without leaving for the app list', async () => {
  renderPage();
  expect(await screen.findByRole('heading', { name: 'Connect Claude' })).toBeInTheDocument();
  expect(screen.getByText('Claude wants to log food, workouts and weight in your Fitness spaces.')).toBeInTheDocument();
  expect(screen.getByText('You can disconnect it any time in Settings → Connected apps.')).toBeInTheDocument();
  expect(publicClient).toHaveBeenCalledWith({ query: { client_id: 'client-1' } });
  expect(replace).not.toHaveBeenCalled();
});

it('Allow accepts and goes back to the app', async () => {
  renderPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Allow' }));
  expect(consent).toHaveBeenCalledWith({ accept: true });
  expect(leaveFor).toHaveBeenCalledWith(back);
});

it('Deny refuses and goes back to the app', async () => {
  renderPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Deny' }));
  expect(consent).toHaveBeenCalledWith({ accept: false });
  expect(leaveFor).toHaveBeenCalledWith(back);
});

it('disables both buttons while the answer is on its way', async () => {
  consent.mockReturnValue(new Promise(() => {}));
  renderPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Allow' }));
  expect(screen.getByRole('button', { name: 'Allow' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Deny' })).toBeDisabled();
});

it('says so when the answer fails', async () => {
  consent.mockResolvedValue({ data: null, error: { status: 400, message: 'invalid_signature' } });
  renderPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Allow' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not finish connecting. Try again from the app.');
  expect(leaveFor).not.toHaveBeenCalled();
});

it('falls back to "An app" when the app can’t be looked up', async () => {
  publicClient.mockResolvedValue({ data: null, error: { status: 404, message: 'not found' } });
  renderPage();
  expect(await screen.findByRole('heading', { name: 'Connect An app' })).toBeInTheDocument();
  expect(screen.getByText('An app wants to log food, workouts and weight in your Fitness spaces.')).toBeInTheDocument();
});

it('says which site Allow sends the person back to, so a look-alike app shows its real address', async () => {
  search.value = 'client_id=client-1&scope=fitness&redirect_uri=https%3A%2F%2Fattacker.example%2Fcb&sig=abc';
  renderPage();
  await screen.findByRole('heading', { name: 'Connect Claude' });
  expect(screen.getByText(/you'll go back to/)).toHaveTextContent("After you allow it, you'll go back to attacker.example.");
});

it('names claude.ai as the return site for the real Claude', async () => {
  renderPage();
  await screen.findByRole('heading', { name: 'Connect Claude' });
  expect(screen.getByText(/you'll go back to/)).toHaveTextContent("After you allow it, you'll go back to claude.ai.");
});
