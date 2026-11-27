import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultPageComponent } from './VaultPageComponent';
import { WrongSecretError } from './vault-crypto';

const crypt = vi.hoisted(() => ({
  createVault: vi.fn(),
  unlockSpaceWithPasscode: vi.fn(),
  unlockWithPasscode: vi.fn(),
  recoverPasscode: vi.fn(),
}));
const api = vi.hoisted(() => ({ saveNewVault: vi.fn(), savePasscodeWrap: vi.fn(), eraseVault: vi.fn() }));
const state = vi.hoisted(() => ({
  vault: { data: null as object | null, isPending: false, isError: false },
  session: { key: null as object | null, spaceKeys: {} as Record<string, object>, unlock: vi.fn(), unlockSpace: vi.fn(), lock: vi.fn() },
  access: { isOwner: true, canEdit: true },
  sharing: { data: null as object | null, isPending: false, isError: false },
}));

vi.mock('./vault-crypto', async (original) => ({ ...(await original<typeof import('./vault-crypto')>()), ...crypt }));
vi.mock('./vault-api', () => api);
vi.mock('../hooks/useVault', () => ({ useVault: () => state.vault }));
vi.mock('../hooks/useVaultSession', () => ({ useVaultSession: () => state.session }));
vi.mock('@/features/spaces', () => ({ useActiveSpace: () => ({ id: 's1', title: 'Safe', ownerName: 'Sam' }), useSpaceAccess: () => state.access }));
vi.mock('../hooks/useVaultSpaceKey', () => ({ useVaultSpaceKey: () => state.sharing }));
vi.mock('./VaultUnlockedComponent', () => ({ VaultUnlockedComponent: () => <p>the open vault</p> }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PASS = 'twelve chars ok';
const material = { salt: 's' };
const key = { fake: 'key' };
const type = (label: string | RegExp, text: string) => userEvent.type(screen.getByLabelText(label), text);
const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));

function renderPage() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VaultPageComponent />
    </QueryClientProvider>,
  );
}

async function fillSetup(first = PASS, second = PASS) {
  await type('Passcode', first);
  await type('Type it again', second);
  await userEvent.click(screen.getByRole('checkbox'));
}

beforeEach(() => {
  vi.clearAllMocks();
  state.vault = { data: null, isPending: false, isError: false };
  state.session.key = null;
  state.session.spaceKeys = {};
  state.access = { isOwner: true, canEdit: true };
  state.sharing = { data: null, isPending: false, isError: false };
  crypt.createVault.mockResolvedValue({ material, recoveryKey: 'AAAA-BBBB', key });
  api.saveNewVault.mockResolvedValue(undefined);
  api.savePasscodeWrap.mockResolvedValue(undefined);
  api.eraseVault.mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllGlobals());

it('asks for a secure connection when Web Crypto is missing', () => {
  vi.stubGlobal('crypto', {});
  renderPage();
  expect(screen.getByText('The vault needs a secure connection')).toBeInTheDocument();
});

it('shows First time when there is no vault', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: 'Set a vault passcode' })).toBeInTheDocument();
});

it('needs the acknowledgement before creating', async () => {
  renderPage();
  expect(screen.getByRole('button', { name: 'Create vault' })).toBeDisabled();
  await userEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: 'Create vault' })).toBeEnabled();
});

it('refuses a short passcode', async () => {
  renderPage();
  await fillSetup('eleven char', 'eleven char');
  await click('Create vault');
  expect(screen.getByRole('alert')).toHaveTextContent('Use at least 12 characters.');
  expect(crypt.createVault).not.toHaveBeenCalled();
});

it('refuses passcodes that differ', async () => {
  renderPage();
  await fillSetup(PASS, `${PASS}x`);
  await click('Create vault');
  expect(screen.getByRole('alert')).toHaveTextContent("Those passcodes don't match.");
  expect(crypt.createVault).not.toHaveBeenCalled();
});

it('shows the recovery key once, then opens the vault after the tick', async () => {
  renderPage();
  await fillSetup();
  await click('Create vault');
  expect(await screen.findByText('AAAA-BBBB')).toBeInTheDocument();
  expect(api.saveNewVault).toHaveBeenCalledWith(material);
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  expect(state.session.unlock).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('checkbox'));
  await click('Continue');
  expect(state.session.unlock).toHaveBeenCalledWith(key);
});

it('tells a second tab the vault already exists and leaves it alone', async () => {
  api.saveNewVault.mockRejectedValue(new Error('This vault was already created in another tab. Reload to unlock it.'));
  renderPage();
  await fillSetup();
  await click('Create vault');
  expect(await screen.findByRole('alert')).toHaveTextContent('already created in another tab');
  expect(state.session.unlock).not.toHaveBeenCalled();
});

describe('with a vault', () => {
  beforeEach(() => {
    state.vault = { data: material, isPending: false, isError: false };
  });

  it('shows the open vault when unlocked', () => {
    state.session.key = key;
    renderPage();
    expect(screen.getByText('the open vault')).toBeInTheDocument();
  });

  it('unlocks with the passcode', async () => {
    crypt.unlockWithPasscode.mockResolvedValue(key);
    renderPage();
    await type('Passcode', PASS);
    await click('Unlock');
    await waitFor(() => expect(state.session.unlock).toHaveBeenCalledWith(key));
    expect(crypt.unlockWithPasscode).toHaveBeenCalledWith(material, PASS);
  });

  it('says the passcode is wrong without saying why', async () => {
    crypt.unlockWithPasscode.mockRejectedValue(new WrongSecretError('details'));
    renderPage();
    await type('Passcode', PASS);
    await click('Unlock');
    expect(await screen.findByRole('alert')).toHaveTextContent('That passcode is not right.');
    expect(screen.getByLabelText('Passcode')).toHaveValue('');
  });

  it('sets a new passcode from the recovery key', async () => {
    crypt.recoverPasscode.mockResolvedValue({ salt: 'new' });
    crypt.unlockWithPasscode.mockResolvedValue(key);
    renderPage();
    await click('Forgot passcode?');
    await type('Recovery key', 'KEY');
    await type('New passcode', PASS);
    await type('Type it again', PASS);
    await click('Set new passcode');
    await waitFor(() => expect(state.session.unlock).toHaveBeenCalledWith(key));
    expect(crypt.recoverPasscode).toHaveBeenCalledWith(material, 'KEY', PASS);
    expect(api.savePasscodeWrap).toHaveBeenCalledWith({ salt: 'new' });
  });

  it('says when the recovery key is wrong', async () => {
    crypt.recoverPasscode.mockRejectedValue(new WrongSecretError('x'));
    renderPage();
    await click('Forgot passcode?');
    await type('Recovery key', 'KEY');
    await type('New passcode', PASS);
    await type('Type it again', PASS);
    await click('Set new passcode');
    expect(await screen.findByRole('alert')).toHaveTextContent('That recovery key is not right.');
    expect(api.savePasscodeWrap).not.toHaveBeenCalled();
  });

  it('only erases after ERASE is typed', async () => {
    renderPage();
    await click('Forgot passcode?');
    await click('Lost your recovery key too?');
    const erase = await screen.findByRole('button', { name: 'Erase vault' });
    expect(erase).toBeDisabled();
    await type('Type ERASE to confirm', 'erase');
    expect(erase).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Type ERASE to confirm'));
    await type('Type ERASE to confirm', 'ERASE');
    await userEvent.click(erase);
    await waitFor(() => expect(api.eraseVault).toHaveBeenCalledTimes(1));
  });
});

describe('a vault shared with you', () => {
  const wrap = { salt: 's', iterations: 600_000, wrappedKey: 'w' };
  beforeEach(() => {
    state.access = { isOwner: false, canEdit: false };
    state.sharing = { data: wrap, isPending: false, isError: false };
  });

  it('asks for the sharing passcode, never your own vault, and opens it with that', async () => {
    const spaceKey = { space: 'key' };
    crypt.unlockSpaceWithPasscode.mockResolvedValue(spaceKey);
    renderPage();
    expect(screen.getByText("Ask Sam for this vault's sharing passcode.")).toBeInTheDocument();
    expect(screen.queryByText(/First time/)).not.toBeInTheDocument();
    await type('Sharing passcode', PASS);
    await click('Unlock');
    expect(crypt.unlockSpaceWithPasscode).toHaveBeenCalledWith(wrap, PASS);
    expect(state.session.unlockSpace).toHaveBeenCalledWith('s1', spaceKey);
  });

  it('says so when the sharing passcode is wrong', async () => {
    crypt.unlockSpaceWithPasscode.mockRejectedValue(new WrongSecretError('no'));
    renderPage();
    await type('Sharing passcode', PASS);
    await click('Unlock');
    expect(await screen.findByRole('alert')).toHaveTextContent('That sharing passcode is not right.');
  });

  it('shows the items once it is open', () => {
    state.session.spaceKeys = { s1: {} };
    renderPage();
    expect(screen.getByText('the open vault')).toBeInTheDocument();
  });
});
