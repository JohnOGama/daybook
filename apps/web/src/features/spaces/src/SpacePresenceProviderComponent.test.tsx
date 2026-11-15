import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { beforeEach, expect, it, vi } from 'vitest';
import { useSpacePresence } from '../hooks/useSpacePresence';
import type { Space } from './space-types';
import { SpacePresenceProviderComponent } from './SpacePresenceProviderComponent';

const { providers, useSession } = vi.hoisted(() => ({ providers: [] as FakeProvider[], useSession: vi.fn() }));
type FakeProvider = {
  messageHandlers: ((encoder: unknown, decoder: decoding.Decoder) => void)[];
  emit(event: string, ...args: unknown[]): void;
};

vi.mock('@/shared/services/auth-client', () => ({ authClient: { useSession } }));
vi.mock('y-websocket', async () => {
  const { Awareness } = await import('y-protocols/awareness');
  class WebsocketProvider {
    messageHandlers: ((encoder: unknown, decoder: unknown) => void)[] = [];
    awareness: InstanceType<typeof Awareness>;
    private listeners = new Map<string, ((...args: unknown[]) => void)[]>();
    constructor(_url: string, _room: string, doc: ConstructorParameters<typeof Awareness>[0]) {
      this.awareness = new Awareness(doc);
      providers.push(this as unknown as FakeProvider);
    }
    on(event: string, listener: (...args: unknown[]) => void) {
      this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
    }
    emit(event: string, ...args: unknown[]) {
      for (const listener of this.listeners.get(event) ?? []) listener(...args);
    }
    destroy() {}
  }
  return { WebsocketProvider };
});

const space = { id: 's1', kind: 'space', tool: 'diagram', access: 'edit' } as Space;

function Probe() {
  const presence = useSpacePresence();
  return <output aria-label="presence">{JSON.stringify({ synced: presence?.synced, connected: presence?.connected, denied: presence?.denied })}</output>;
}
function renderProvider() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    <QueryClientProvider client={client}>
      <SpacePresenceProviderComponent space={space}>
        <Probe />
      </SpacePresenceProviderComponent>
    </QueryClientProvider>,
  );
  return { provider: providers.at(-1) as FakeProvider, invalidate };
}
const state = () => JSON.parse(screen.getByRole('status', { name: 'presence' }).textContent ?? '{}');
function sendMembers(provider: FakeProvider, members: object[]) {
  const encoder = encoding.createEncoder();
  encoding.writeVarString(encoder, JSON.stringify(members));
  act(() => provider.messageHandlers[100](encoding.createEncoder(), decoding.createDecoder(encoding.toUint8Array(encoder))));
}

beforeEach(() => {
  providers.length = 0;
  useSession.mockReturnValue({ data: { user: { id: 'me' } } });
});

it('stays synced after the connection drops once it has synced, so the page is not torn down', () => {
  const { provider } = renderProvider();
  act(() => {
    provider.emit('status', { status: 'connected' });
    provider.emit('sync', true);
  });
  expect(state()).toMatchObject({ synced: true, connected: true });
  act(() => {
    provider.emit('status', { status: 'disconnected' });
    provider.emit('sync', false);
  });
  expect(state()).toMatchObject({ synced: true, connected: false });
});

it('marks the space as closed to you when the server ends the connection for good', () => {
  const { provider } = renderProvider();
  act(() => provider.emit('connection-close', { code: 1006 }));
  expect(state().denied).toBe(false);
  act(() => provider.emit('connection-close', { code: 4403 }));
  expect(state().denied).toBe(true);
});

it('refreshes the spaces list when the server reports a different access for you', () => {
  const { provider, invalidate } = renderProvider();
  sendMembers(provider, [{ userId: 'me', name: 'Me', image: null, access: 'edit', clientIds: [1] }]);
  expect(invalidate).not.toHaveBeenCalled();
  sendMembers(provider, [{ userId: 'me', name: 'Me', image: null, access: 'view', clientIds: [1] }]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['spaces'] });
});
