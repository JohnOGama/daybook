import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Space } from '@/features/spaces';
import { LiveUpdatesProviderComponent } from './LiveUpdatesProviderComponent';

class FakeSocket {
  static all: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  close() {}
  open() {
    act(() => this.onopen?.());
  }
  receive(message: unknown) {
    act(() => this.onmessage?.({ data: JSON.stringify(message) }));
  }
  drop(code: number) {
    act(() => this.onclose?.({ code }));
  }
}

const spaces = [
  { id: 's1', title: 'Backend', tool: 'pipelines', pipelines: 'passed' },
  { id: 's2', title: 'Home', tool: 'list', pipelines: null },
] as Space[];

function renderProvider() {
  const client = new QueryClient();
  client.setQueryData(['spaces'], spaces);
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <LiveUpdatesProviderComponent>
        <p>app</p>
      </LiveUpdatesProviderComponent>
    </QueryClientProvider>,
  );
  return { client, invalidate, socket: FakeSocket.all.at(-1) as FakeSocket };
}

beforeEach(() => {
  FakeSocket.all = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('opens the per-user socket on the same origin', () => {
  const { socket } = renderProvider();
  expect(socket.url).toBe(`ws://${window.location.host}/api/realtime/me`);
});

it("a pipeline message patches the space's dot and invalidates its page and runs", () => {
  const { client, invalidate, socket } = renderProvider();
  socket.open();
  socket.receive({ type: 'pipeline', spaceId: 's1', status: 'running' });
  expect(client.getQueryData<Space[]>(['spaces'])?.find((s) => s.id === 's1')?.pipelines).toBe('running');
  expect(client.getQueryData<Space[]>(['spaces'])?.find((s) => s.id === 's2')).toBe(spaces[1]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pipelines', 's1'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pipeline-run'] });
});

it("an uptime message patches the space's dot and invalidates its page and site", () => {
  const { client, invalidate, socket } = renderProvider();
  socket.open();
  socket.receive({ type: 'uptime', spaceId: 's1', status: 'down' });
  expect(client.getQueryData<Space[]>(['spaces'])?.find((s) => s.id === 's1')?.uptime).toBe('down');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['uptime', 's1'] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['uptime-monitor'] });
});

it('ignores unknown message types', () => {
  const { client, invalidate, socket } = renderProvider();
  socket.open();
  socket.receive({ type: 'something-else', spaceId: 's1', status: 'failed' });
  expect(client.getQueryData(['spaces'])).toBe(spaces);
  expect(invalidate).not.toHaveBeenCalled();
});

it('reconnects after a drop and refreshes the spaces, but stops after a 4403 close', () => {
  const { invalidate, socket } = renderProvider();
  socket.open();
  socket.drop(1006);
  act(() => vi.advanceTimersByTime(1000));
  expect(FakeSocket.all).toHaveLength(2);
  FakeSocket.all[1].open();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['spaces'] });
  FakeSocket.all[1].drop(4403);
  act(() => vi.advanceTimersByTime(60_000));
  expect(FakeSocket.all).toHaveLength(2);
});
