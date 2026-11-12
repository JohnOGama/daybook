import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { VaultOptionsMenuComponent } from './VaultOptionsMenuComponent';
import { WrongSecretError } from './vault-crypto';

const state = vi.hoisted(() => ({
  downloadFile: vi.fn(),
  changePasscode: vi.fn(),
  replaceRecoveryKey: vi.fn(),
  savePasscodeWrap: vi.fn(),
  saveRecoveryWrap: vi.fn(),
}));

vi.mock('@/shared/utils/download-file', () => ({ downloadFile: state.downloadFile }));
vi.mock('./vault-api', () => ({ savePasscodeWrap: state.savePasscodeWrap, saveRecoveryWrap: state.saveRecoveryWrap }));
vi.mock('./vault-crypto', async (original) => ({
  ...(await original<typeof import('./vault-crypto')>()),
  changePasscode: state.changePasscode,
  replaceRecoveryKey: state.replaceRecoveryKey,
}));
vi.mock('../hooks/useVault', () => ({ useVault: () => ({ data: material }) }));
vi.mock('@/shared/hooks/useToday', () => ({ useToday: () => '2026-11-10' }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const material = { salt: 's', iterations: 600_000, wrappedKey: 'w', recoverySalt: 'r', recoveryWrappedKey: 'rw' };
const records = [{ id: 'a', iv: 'iv', ciphertext: 'scrambled', updatedAt: 'x' }];
const onImport = vi.fn();
const onRecoveryKey = vi.fn();
const PASS = 'current passcode 1';

async function enter(field: HTMLElement, text: string) {
  await userEvent.click(field);
  await userEvent.paste(text);
}

function renderMenu() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <VaultOptionsMenuComponent records={records} onImport={onImport} onRecoveryKey={onRecoveryKey} />
    </QueryClientProvider>,
  );
}

async function choose(name: string) {
  renderMenu();
  await userEvent.click(screen.getByRole('button', { name: 'Vault options' }));
  await userEvent.click(await screen.findByRole('menuitem', { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  state.savePasscodeWrap.mockResolvedValue(undefined);
  state.saveRecoveryWrap.mockResolvedValue(undefined);
});

it('exports the space as an encrypted file', async () => {
  await choose('Export backup');
  const [name, text] = state.downloadFile.mock.calls[0];
  expect(name).toBe('daybook-vault-backup-2026-11-10.json');
  expect(JSON.parse(text)).toMatchObject({
    format: 'daybook-vault-backup',
    material,
    items: [{ id: 'a', iv: 'iv', ciphertext: 'scrambled' }],
  });
});

it('opens the import pane', async () => {
  await choose('Import backup');
  expect(onImport).toHaveBeenCalled();
});

it('asks for the current passcode before changing it', async () => {
  state.changePasscode.mockResolvedValue({ salt: 'new' });
  await choose('Change passcode');
  await enter(await screen.findByLabelText('Current passcode'), PASS);
  await enter(screen.getByLabelText('New passcode'), 'a brand new passcode');
  await enter(screen.getByLabelText('Type it again'), 'a brand new passcode');
  await userEvent.click(screen.getByRole('button', { name: 'Change passcode' }));
  await waitFor(() => expect(state.savePasscodeWrap).toHaveBeenCalledWith({ salt: 'new' }));
  expect(state.changePasscode).toHaveBeenCalledWith(material, PASS, 'a brand new passcode');
});

it('refuses a wrong current passcode', async () => {
  state.changePasscode.mockRejectedValue(new WrongSecretError('x'));
  await choose('Change passcode');
  await enter(await screen.findByLabelText('Current passcode'), 'nope nope nope');
  await enter(screen.getByLabelText('New passcode'), 'a brand new passcode');
  await enter(screen.getByLabelText('Type it again'), 'a brand new passcode');
  await userEvent.click(screen.getByRole('button', { name: 'Change passcode' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('That passcode is not right.');
  expect(state.savePasscodeWrap).not.toHaveBeenCalled();
});

it('asks for the passcode, then hands over the new recovery key once saved', async () => {
  state.replaceRecoveryKey.mockResolvedValue({ recoverySalt: 'r2', recoveryWrappedKey: 'w2', recoveryKey: 'NEW-KEY' });
  await choose('New recovery key');
  await enter(await screen.findByLabelText('Passcode'), PASS);
  await userEvent.click(screen.getByRole('button', { name: 'Make new key' }));
  await waitFor(() => expect(onRecoveryKey).toHaveBeenCalledWith('NEW-KEY'));
  expect(state.saveRecoveryWrap).toHaveBeenCalledWith({ recoverySalt: 'r2', recoveryWrappedKey: 'w2' });
});
