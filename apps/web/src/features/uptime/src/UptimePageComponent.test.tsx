import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Bar, MonitorRow, UptimeView } from './uptime-types';
import { UptimePageComponent } from './UptimePageComponent';

const { access } = vi.hoisted(() => ({ access: { value: { access: 'owner', canEdit: true, isOwner: true } } }));

vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'My sites', tool: 'uptime' }),
  useSpaceAccess: () => access.value,
  PresenceAvatarsComponent: () => null,
  ViewOnlyBadgeComponent: () => null,
}));

const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const bars = (status: Bar): Bar[] => new Array(48).fill(status);
const site = (fields: Partial<MonitorRow>): MonitorRow => ({
  id: 'm1',
  name: 'Daybook web',
  url: 'https://daybook.example',
  kind: 'web',
  paused: false,
  status: 'up',
  lastCheckedAt: ago(12_000),
  lastResponseMs: 182,
  lastError: null,
  downSince: null,
  bars: bars('up'),
  uptime24h: 99.2,
  ...fields,
});
const view: UptimeView = {
  monitors: [
    site({}),
    site({ id: 'm2', name: 'Gym API', kind: 'api', url: 'https://api.gym.example/api/health', status: 'down', lastResponseMs: null, lastError: '502 Bad Gateway', downSince: ago(12 * 60_000), uptime24h: 97.1 }),
    site({ id: 'm3', name: 'Strivio web', status: 'slow', lastResponseMs: 3400, uptime24h: 100 }),
    site({ id: 'm4', name: 'Old site', paused: true, uptime24h: null }),
  ],
  uptime24h: 98.6,
  incidents7d: 2,
  lastCheckedAt: ago(12_000),
};

type Route = { status?: number; body?: unknown };
let routes: Record<string, Route>;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const { status = 200, body = null } = routes[`${init?.method ?? 'GET'} ${url}`] ?? { status: 404 };
  return new Response(JSON.stringify(body), { status });
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <UptimePageComponent />
    </QueryClientProvider>,
  );
}

const sentBody = (method: string, url: string) => JSON.parse(String(fetchMock.mock.calls.find(([u, init]) => u === url && init?.method === method)?.[1]?.body));

beforeEach(() => {
  access.value = { access: 'owner', canEdit: true, isOwner: true };
  routes = { 'GET /api/uptime/s1': { body: view } };
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it('shows each site with its status, response, bars and 24 h uptime, and the tiles', async () => {
  renderPage();
  expect(await screen.findByText('2 of 3')).toBeInTheDocument();
  expect(screen.getByText('98.6%')).toBeInTheDocument();
  expect(screen.getByText('Last check 12 s ago', { exact: false })).toBeInTheDocument();
  const gym = screen.getByRole('row', { name: /Gym API/ });
  expect(within(gym).getByText('Down')).toBeInTheDocument();
  expect(within(gym).getByText('502 Bad Gateway · down for 12 minutes')).toBeInTheDocument();
  expect(within(gym).getByText('97.1%')).toBeInTheDocument();
  const web = screen.getByRole('row', { name: /Daybook web/ });
  expect(within(web).getByText('182 ms')).toBeInTheDocument();
  expect(within(web).getByText('99.2%')).toBeInTheDocument();
  expect(within(web).getByLabelText('Last 24 hours').children).toHaveLength(48);
  expect(within(screen.getByRole('row', { name: /Strivio web/ })).getByText('Slow')).toBeInTheDocument();
  expect(within(screen.getByRole('row', { name: /Old site/ })).getByText('Paused')).toBeInTheDocument();
});

it('adds a site and shows it straight away', async () => {
  routes['POST /api/uptime/s1/monitors'] = { status: 201, body: site({ id: 'm9', name: 'Strivio API', kind: 'api', url: 'https://api.strivio.example/api/health' }) };
  renderPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Add site' }));
  const dialog = screen.getByRole('dialog', { name: 'Add site' });
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Strivio API');
  await userEvent.click(within(dialog).getByRole('button', { name: 'API' }));
  expect(within(dialog).getByText(/use a health route/)).toBeInTheDocument();
  await userEvent.type(within(dialog).getByLabelText('URL'), 'https://api.strivio.example/api/health');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add and check now' }));
  expect(await screen.findByRole('row', { name: /Strivio API/ })).toBeInTheDocument();
  expect(sentBody('POST', '/api/uptime/s1/monitors')).toEqual({ id: expect.any(String), name: 'Strivio API', url: 'https://api.strivio.example/api/health', kind: 'api' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('shows the server reason when a URL is refused, keeping the dialog open', async () => {
  routes['POST /api/uptime/s1/monitors'] = { status: 400, body: { message: 'Public addresses only' } };
  renderPage();
  await userEvent.click(await screen.findByRole('button', { name: 'Add site' }));
  const dialog = screen.getByRole('dialog', { name: 'Add site' });
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Router');
  await userEvent.type(within(dialog).getByLabelText('URL'), 'http://192.168.1.1');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add and check now' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Public addresses only');
});

it('opens a site in the drawer', async () => {
  routes['GET /api/uptime/monitors/m2'] = { body: { ...view.monitors[1], uptime7d: 99.4, uptime30d: 99.8, responseBars: new Array(48).fill(null), incidents: [] } };
  renderPage();
  await userEvent.click(await screen.findByRole('button', { name: /Gym API/ }));
  expect(await screen.findByText('99.4%')).toBeInTheDocument();
  expect(screen.getByText('No incidents in the last 30 days.')).toBeInTheDocument();
});

it('hides Add site from viewers', async () => {
  access.value = { access: 'view', canEdit: false, isOwner: false };
  renderPage();
  await screen.findByText('2 of 3');
  expect(screen.queryByRole('button', { name: 'Add site' })).not.toBeInTheDocument();
});

it('shows an empty state with Add site when there are no sites', async () => {
  routes['GET /api/uptime/s1'] = { body: { monitors: [], uptime24h: null, incidents7d: 0, lastCheckedAt: null } };
  renderPage();
  expect(await screen.findByText('No sites yet')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Add site' }).length).toBeGreaterThan(0);
});
