import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MonitorDrawerComponent } from './MonitorDrawerComponent';
import type { MonitorDetail } from './uptime-types';

const { access } = vi.hoisted(() => ({ access: { value: { access: 'owner', canEdit: true, isOwner: true } } }));

vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'My sites', tool: 'uptime' }),
  useSpaceAccess: () => access.value,
}));

const MIN = 60_000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const ongoingSince = ago(12 * MIN);
const closedStart = ago(26 * 60 * MIN);
const closedEnd = ago(26 * 60 * MIN - 25 * MIN);

const detail = (fields: Partial<MonitorDetail> = {}): MonitorDetail => ({
  id: 'm1',
  name: 'Gym API',
  url: 'https://api.gym.example/api/health',
  kind: 'api',
  paused: false,
  status: 'down',
  lastCheckedAt: ago(10_000),
  lastResponseMs: null,
  lastError: '502 Bad Gateway',
  downSince: ongoingSince,
  bars: new Array(48).fill('up'),
  uptime24h: 97.1,
  uptime7d: 99.4,
  uptime30d: 99.8,
  responseBars: Array.from({ length: 48 }, (_, index) => (index > 45 ? null : 100 + index)),
  incidents: [
    { id: 'i2', startedAt: ongoingSince, endedAt: null, reason: '502 Bad Gateway' },
    { id: 'i1', startedAt: closedStart, endedAt: closedEnd, reason: 'Timed out after 10 s' },
  ],
  ...fields,
});

type Route = { status?: number; body?: unknown };
let routes: Record<string, Route>;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const { status = 200, body = null } = routes[`${init?.method ?? 'GET'} ${url}`] ?? { status: 404 };
  return new Response(body === null ? null : JSON.stringify(body), { status });
});
const called = (method: string, url: string) => fetchMock.mock.calls.find(([u, init]) => u === url && (init?.method ?? 'GET') === method);

const onClose = vi.fn();

function renderDrawer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MonitorDrawerComponent monitorId="m1" onClose={onClose} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  access.value = { access: 'owner', canEdit: true, isOwner: true };
  routes = { 'GET /api/uptime/monitors/m1': { body: detail() } };
  fetchMock.mockClear();
  onClose.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

it('shows uptime for 24 h, 7 days and 30 days, the response chart and the incidents newest first', async () => {
  renderDrawer();
  expect(await screen.findByText('97.1%')).toBeInTheDocument();
  expect(screen.getByText('99.4%')).toBeInTheDocument();
  expect(screen.getByText('99.8%')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Response time, last 24 hours' })).toBeInTheDocument();
  const incidents = within(screen.getByRole('list', { name: 'Incidents' })).getAllByRole('listitem');
  expect(incidents[0]).toHaveTextContent(`Down now · since ${clock(ongoingSince)} (12 minutes)`);
  expect(incidents[0]).toHaveTextContent('502 Bad Gateway');
  expect(incidents[1]).toHaveTextContent('Down 25 minutes');
  expect(incidents[1]).toHaveTextContent(`${clock(closedStart)}–${clock(closedEnd)}`);
  expect(incidents[1]).toHaveTextContent('Timed out after 10 s');
});

it('checks now and shows the new status', async () => {
  routes['POST /api/uptime/monitors/m1/check'] = { status: 201, body: detail({ status: 'up', lastError: null, downSince: null }) };
  renderDrawer();
  const checkNow = await screen.findByRole('button', { name: 'Check now' });
  routes['GET /api/uptime/monitors/m1'] = { body: detail({ status: 'up', lastError: null, downSince: null }) };
  await userEvent.click(checkNow);
  await waitFor(() => expect(called('POST', '/api/uptime/monitors/m1/check')).toBeTruthy());
  expect(await screen.findByText('Up')).toBeInTheDocument();
});

it('pauses and resumes', async () => {
  routes['PATCH /api/uptime/monitors/m1'] = { body: detail({ paused: true }) };
  renderDrawer();
  const pause = await screen.findByRole('button', { name: 'Pause' });
  routes['GET /api/uptime/monitors/m1'] = { body: detail({ paused: true }) };
  await userEvent.click(pause);
  await waitFor(() => expect(called('PATCH', '/api/uptime/monitors/m1')).toBeTruthy());
  expect(JSON.parse(String(called('PATCH', '/api/uptime/monitors/m1')?.[1]?.body))).toEqual({ paused: true });
  expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
});

it('deletes after confirming and closes', async () => {
  routes['DELETE /api/uptime/monitors/m1'] = { status: 200 };
  renderDrawer();
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  const confirm = screen.getByRole('alertdialog', { name: 'Delete Gym API?' });
  expect(confirm).toHaveTextContent("Its history and incidents go too. This can't be undone.");
  await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(called('DELETE', '/api/uptime/monitors/m1')).toBeTruthy());
  expect(onClose).toHaveBeenCalled();
});

it('shows no actions to a viewer', async () => {
  access.value = { access: 'view', canEdit: false, isOwner: false };
  renderDrawer();
  await screen.findByText('97.1%');
  for (const name of ['Check now', 'Edit', 'Pause', 'Delete']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
});
