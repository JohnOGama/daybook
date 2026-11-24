import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FocusPageComponent } from './FocusPageComponent';
import { FocusPillComponent } from './FocusPillComponent';
import { FocusTimerProviderComponent } from './FocusTimerProviderComponent';
import { DEFAULT_SETTINGS, type FocusView, type TimerState } from './focus-types';

const { access, path } = vi.hoisted(() => ({
  access: { value: { access: 'owner', canEdit: true, isOwner: true } },
  path: { current: '/focus' },
}));

vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'Deep work', tool: 'focus' }),
  useSpaceAccess: () => access.value,
  useSpaces: () => ({
    data: [
      { id: 's2', kind: 'space', tool: 'focus', title: 'Writing' },
    ],
  }),
  PresenceAvatarsComponent: () => null,
  ViewOnlyBadgeComponent: () => null,
}));
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-11-24' }));
vi.mock('next/navigation', () => ({ usePathname: () => path.current }));
vi.mock('@/shared/utils/chime', () => ({ chime: vi.fn() }));

const view: FocusView = { settings: { ...DEFAULT_SETTINGS, focusMinutes: 1 }, sessions: [] };
const fetchMock = vi.fn();

function show() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FocusTimerProviderComponent>
        {path.current === '/focus' && <FocusPageComponent />}
        <FocusPillComponent />
      </FocusTimerProviderComponent>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-11-24T09:00:00'));
  localStorage.clear();
  access.value = { access: 'owner', canEdit: true, isOwner: true };
  path.current = '/focus';
  fetchMock.mockReset().mockImplementation(async (url: string, init?: RequestInit) =>
    init?.method ? new Response(null, { status: 201 }) : new Response(JSON.stringify(view), { status: 200 }),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

it('runs a focus session and records it when the time runs out', async () => {
  show();
  await user().click(await screen.findByRole('button', { name: 'Start' }));
  expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
  await act(() => vi.advanceTimersByTimeAsync(61_000));
  const posted = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
  expect(posted?.[0]).toBe('/api/focus/s1/sessions');
  expect(JSON.parse(posted?.[1].body)).toMatchObject({ day: '2026-11-24', minutes: 1, taskId: null, taskTitle: null });
  expect(screen.getByRole('timer', { name: 'Short break time left' })).toHaveTextContent('05:00');
  expect(screen.getByText('Sessions today').nextSibling).toHaveTextContent('1');
});

it('floats the timer on other pages even before it starts, starts it from there, and hides it when idle', async () => {
  const { unmount } = show();
  await screen.findByRole('button', { name: 'Start' });
  unmount();
  path.current = '/list';
  show();
  const pill = await screen.findByRole('status', { name: 'Focus timer' });
  expect(pill).toHaveTextContent('01:00');
  expect(pill).toHaveTextContent('Focus · ready');
  expect(within(pill).getByRole('link')).toHaveAttribute('href', '/focus?space=s1');
  await user().click(within(pill).getByRole('button', { name: 'Start focus timer' }));
  expect(within(pill).queryByRole('button', { name: 'Hide focus timer' })).not.toBeInTheDocument();
  await user().click(within(pill).getByRole('button', { name: 'Pause focus timer' }));
  expect(pill).toHaveTextContent('Paused');
});

it('hides an idle floating timer until a Focus space is opened again', async () => {
  const { unmount } = show();
  await screen.findByRole('button', { name: 'Start' });
  unmount();
  path.current = '/list';
  show();
  await user().click(await screen.findByRole('button', { name: 'Hide focus timer' }));
  expect(screen.queryByRole('status', { name: 'Focus timer' })).not.toBeInTheDocument();
  expect(localStorage.getItem('daybook-focus-timer')).toBeNull();
});

it('keeps counting on other pages, with a pill that pauses it', async () => {
  const { unmount } = show();
  await user().click(await screen.findByRole('button', { name: 'Start' }));
  unmount();
  path.current = '/list';
  show();
  const pill = await screen.findByRole('status', { name: 'Focus timer' });
  expect(pill).toHaveTextContent('01:00');
  await user().click(within(pill).getByRole('button', { name: 'Pause focus timer' }));
  expect(within(pill).getByText('Paused')).toBeInTheDocument();
});

it('moves the floating timer, keeps it on screen, and remembers where it was', async () => {
  localStorage.setItem('daybook-focus-pill-position', JSON.stringify({ right: 100, bottom: 200 }));
  const { unmount } = show();
  await screen.findByRole('button', { name: 'Start' });
  unmount();
  path.current = '/list';
  show();
  const pill = await screen.findByRole('status', { name: 'Focus timer' });
  expect(pill).toHaveStyle({ right: '100px', bottom: '200px' });
  pill.focus();
  await user().keyboard('{ArrowLeft}{ArrowUp}');
  expect(pill).toHaveStyle({ right: '116px', bottom: '216px' });
  expect(JSON.parse(localStorage.getItem('daybook-focus-pill-position') ?? '')).toEqual({ right: 116, bottom: 216 });
  for (let step = 0; step < 100; step++) await user().keyboard('{ArrowRight}');
  expect(pill).toHaveStyle({ right: '8px' });
  expect(within(pill).queryByRole('button', { name: /Move/ })).not.toBeInTheDocument();
});

it('drags the floating timer by its body without following the link on release', async () => {
  const { unmount } = show();
  await screen.findByRole('button', { name: 'Start' });
  unmount();
  path.current = '/list';
  show();
  const pill = await screen.findByRole('status', { name: 'Focus timer' });
  const link = within(pill).getByRole('link');
  const followed = vi.fn((event: Event) => event.defaultPrevented || event.preventDefault());
  link.addEventListener('click', followed);
  fireEvent.pointerDown(link, { button: 0, clientX: 500, clientY: 500, pointerId: 1 });
  fireEvent.pointerMove(link, { clientX: 440, clientY: 470, pointerId: 1 });
  fireEvent.pointerUp(link, { pointerId: 1 });
  fireEvent.click(link);
  expect(pill).toHaveStyle({ right: '80px', bottom: '110px' });
  expect(followed).not.toHaveBeenCalled();
  fireEvent.click(link);
  expect(followed).toHaveBeenCalled();
});

it('will not start here while another Focus space has a timer under way', async () => {
  const other: TimerState = { spaceId: 's2', phase: 'focus', endsAt: Date.now() + 600_000, leftMs: 0, startedAt: new Date().toISOString(), sessionId: 'x', completed: 0, task: null, settings: DEFAULT_SETTINGS };
  localStorage.setItem('daybook-focus-timer', JSON.stringify(other));
  show();
  expect(await screen.findByRole('link', { name: 'Writing' })).toHaveAttribute('href', '/focus?space=s2');
  expect(screen.getByRole('button', { name: 'Start' })).toBeDisabled();
});

it('shows a viewer the sessions but not the timer', async () => {
  access.value = { access: 'view', canEdit: false, isOwner: false };
  show();
  expect(await screen.findByText(/The timer is for people who can edit it/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
});
