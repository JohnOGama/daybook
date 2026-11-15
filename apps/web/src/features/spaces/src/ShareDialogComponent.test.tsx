import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ShareDialogComponent } from './ShareDialogComponent';
import type { Share, Space } from './space-types';

const { toast } = vi.hoisted(() => ({ toast: { error: vi.fn() } }));
vi.mock('sonner', () => ({ toast }));

const space: Space = {
  id: 's1',
  parentId: null,
  kind: 'space',
  title: 'Home',
  tool: 'list',
  carryOver: true,
  locked: false,
  createdAt: '',
  openToday: 0,
  access: 'owner',
  shared: false,
  ownerId: 'me',
  ownerName: null,
};

let shares: Share[] = [];
let invite: (() => Response) | undefined;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (!init?.method) return Response.json(shares);
  if (init.method === 'POST') {
    await new Promise<void>((resolve) => (release = resolve));
    return invite?.() ?? new Response(null, { status: 201 });
  }
  return new Response(null, { status: 200 });
});
let release = () => {};

function renderDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ShareDialogComponent space={space} open onOpenChange={() => {}} />
    </QueryClientProvider>,
  );
}

async function inviteSam() {
  await userEvent.type(screen.getByRole('textbox', { name: 'Email' }), ' Sam@Example.com ');
  await userEvent.click(screen.getByRole('button', { name: 'Invite' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  shares = [];
  invite = undefined;
  vi.stubGlobal('fetch', fetchMock);
});

it('is titled after the space and says only you can see it when nobody is invited', async () => {
  renderDialog();
  expect(screen.getByRole('heading', { name: 'Share "Home"' })).toBeInTheDocument();
  expect(await screen.findByText('Only you can see this.')).toBeInTheDocument();
});

it('lists the people it is shared with', async () => {
  shares = [{ id: 'a', email: 'ann@example.com', role: 'view' }];
  renderDialog();
  expect(await screen.findByRole('button', { name: 'Remove ann@example.com' })).toBeInTheDocument();
});

it('adds the invite straight away, as Can edit, with a lowercased email', async () => {
  renderDialog();
  await screen.findByText('Only you can see this.');
  await inviteSam();
  expect(await screen.findByRole('button', { name: 'Remove sam@example.com' })).toBeInTheDocument();
  const [, init] = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST') ?? [];
  expect(JSON.parse(String(init?.body))).toMatchObject({ email: 'sam@example.com', role: 'edit' });
  release();
});

it('removes the invite and shows a toast when it fails', async () => {
  invite = () => Response.json({ message: "That's your own email" }, { status: 400 });
  renderDialog();
  await screen.findByText('Only you can see this.');
  await inviteSam();
  expect(await screen.findByRole('button', { name: 'Remove sam@example.com' })).toBeInTheDocument();
  release();
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove sam@example.com' })).not.toBeInTheDocument());
  expect(toast.error).toHaveBeenCalledWith("That's your own email");
});

it('inviting someone already listed changes their role instead', async () => {
  shares = [{ id: 'a', email: 'sam@example.com', role: 'view' }];
  renderDialog();
  await screen.findByRole('button', { name: 'Remove sam@example.com' });
  await inviteSam();
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith('/api/spaces/s1/shares/a', expect.objectContaining({ method: 'PATCH' })),
  );
  expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  expect(screen.getAllByRole('button', { name: /^Remove/ })).toHaveLength(1);
});

it('removes a person straight away', async () => {
  shares = [{ id: 'a', email: 'ann@example.com', role: 'view' }];
  renderDialog();
  await userEvent.click(await screen.findByRole('button', { name: 'Remove ann@example.com' }));
  expect(screen.queryByRole('button', { name: 'Remove ann@example.com' })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith('/api/spaces/s1/shares/a', expect.objectContaining({ method: 'DELETE' }));
});
