import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConnectedAppsComponent } from './ConnectedAppsComponent';

const { toast } = vi.hoisted(() => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('sonner', () => ({ toast }));

const claude = { id: 'consent-1', name: 'Claude', connectedAt: '2026-11-21T08:00:00.000Z', scopes: ['openid', 'fitness'] };
const chatgpt = { id: 'consent-2', name: 'ChatGPT', connectedAt: '2026-11-20T08:00:00.000Z', scopes: ['fitness'] };

let fetchMock: ReturnType<typeof vi.fn>;

function renderApps() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <ConnectedAppsComponent />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === 'DELETE' ? new Response(null, { status: 200 }) : Response.json([claude, chatgpt]),
  );
  vi.stubGlobal('fetch', fetchMock);
  toast.success.mockClear();
  toast.error.mockClear();
});

afterEach(() => vi.unstubAllGlobals());

it('lists connected apps with when they connected', async () => {
  renderApps();
  expect(await screen.findByRole('cell', { name: 'Claude' })).toBeInTheDocument();
  expect(screen.getByText('Connected 21 Nov 2026')).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: 'ChatGPT' })).toBeInTheDocument();
});

it('shows the empty state', async () => {
  fetchMock.mockResolvedValue(Response.json([]));
  renderApps();
  expect(await screen.findByText('No apps connected yet.')).toBeInTheDocument();
});

it('Disconnect removes the app and calls DELETE', async () => {
  renderApps();
  await userEvent.click(await screen.findByRole('button', { name: 'Disconnect Claude' }));
  await waitFor(() => expect(screen.queryByRole('cell', { name: 'Claude' })).not.toBeInTheDocument());
  expect(fetchMock).toHaveBeenCalledWith('/api/connected-apps/consent-1', { method: 'DELETE' });
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Disconnected Claude'));
});

it('a failed Disconnect brings the app back with a toast', async () => {
  renderApps();
  await screen.findByRole('cell', { name: 'Claude' });
  fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
    init?.method === 'DELETE' ? new Response(null, { status: 500 }) : Response.json([claude, chatgpt]),
  );
  await userEvent.click(screen.getByRole('button', { name: 'Disconnect Claude' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Could not disconnect Claude'));
  expect(screen.getByRole('cell', { name: 'Claude' })).toBeInTheDocument();
});
