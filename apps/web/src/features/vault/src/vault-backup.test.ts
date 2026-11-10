import { expect, it, vi } from 'vitest';
import { backupFileName, buildBackup, InvalidBackupError, openBackup, parseBackup, sealForImport } from './vault-backup';
import { createVault, decryptJson, encryptJson, WrongSecretError } from './vault-crypto';
import type { ItemContent } from './vault-types';

// Real key derivation is slow on purpose, and slower still while the whole suite runs.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const PASS = 'backup passcode 12';
const content: ItemContent = { version: 1, type: 'card', name: 'Card', fields: [], notes: '' };

async function sample() {
  const { material, recoveryKey, key } = await createVault(PASS);
  const id = crypto.randomUUID();
  const record = { id, updatedAt: '2026-11-10T00:00:00.000Z', ...(await encryptJson(key, id, content)) };
  return { backup: buildBackup(material, [record], '2026-11-10T00:00:00.000Z'), recoveryKey };
}

it('names the file by date', () => {
  expect(backupFileName('2026-11-10')).toBe('daybook-vault-backup-2026-11-10.json');
});

it('opens a backup with its passcode or its recovery key', async () => {
  const { backup, recoveryKey } = await sample();
  await expect(openBackup(backup, PASS)).resolves.toMatchObject([{ name: 'Card' }]);
  await expect(openBackup(backup, recoveryKey)).resolves.toMatchObject([{ name: 'Card' }]);
});

it('survives a round trip through the file text', async () => {
  const { backup } = await sample();
  expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
});

it('reports a wrong secret', async () => {
  const { backup } = await sample();
  await expect(openBackup(backup, 'not the passcode!!')).rejects.toBeInstanceOf(WrongSecretError);
});

it('re-seals items under new ids for another vault', async () => {
  const { backup } = await sample();
  const other = await createVault('another account pass');
  const contents = await openBackup(backup, PASS);
  const [sealed] = await sealForImport(other.key, contents);
  expect(sealed.id).not.toBe(backup.items[0].id);
  await expect(decryptJson(other.key, sealed.id, sealed)).resolves.toMatchObject({ name: 'Card' });
});

it('refuses a tampered item', async () => {
  const { backup } = await sample();
  const swapped = { ...backup, items: [{ ...backup.items[0], id: crypto.randomUUID() }] };
  await expect(openBackup(swapped, PASS)).rejects.toBeInstanceOf(InvalidBackupError);
});

it('refuses weak settings', async () => {
  const { backup } = await sample();
  expect(() => parseBackup(JSON.stringify({ ...backup, material: { ...backup.material, iterations: 1000 } }))).toThrow(
    InvalidBackupError,
  );
});

it.each([
  ['not json', 'nope'],
  ['another JSON file', '{"a":1}'],
])('refuses %s', (_, text) => {
  expect(() => parseBackup(text)).toThrow(InvalidBackupError);
});

it('refuses more than 2,000 items', async () => {
  const { backup } = await sample();
  const items = Array.from({ length: 2001 }, () => backup.items[0]);
  expect(() => parseBackup(JSON.stringify({ ...backup, items }))).toThrow(InvalidBackupError);
});

it('refuses an item over 64 KB', async () => {
  const { backup } = await sample();
  const items = [{ ...backup.items[0], ciphertext: btoa('x'.repeat(65_537)) }];
  expect(() => parseBackup(JSON.stringify({ ...backup, items }))).toThrow(InvalidBackupError);
});
