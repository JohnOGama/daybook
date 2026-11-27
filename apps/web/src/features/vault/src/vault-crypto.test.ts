import { describe, expect, it, vi } from 'vitest';
import {
  changePasscode,
  changeSpacePasscode,
  createSpaceKey,
  createVault,
  decryptJson,
  encryptJson,
  recoverPasscode,
  replaceRecoveryKey,
  unlockSpaceAsOwner,
  unlockSpaceWithPasscode,
  unlockWithPasscode,
  unlockWithRecoveryKey,
  WeakSettingsError,
  WrongSecretError,
} from './vault-crypto';

// Real key derivation is slow on purpose, and slower still while the whole suite runs.
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 });

const PASS = 'correct horse battery';

describe('vault crypto', () => {
  it('round-trips an item and stores no plaintext', async () => {
    const { key } = await createVault(PASS);
    const sealed = await encryptJson(key, 'id-1', { name: 'Travel card' });
    expect(atob(sealed.ciphertext)).not.toContain('Travel card');
    await expect(decryptJson(key, 'id-1', sealed)).resolves.toEqual({ name: 'Travel card' });
  });

  it('uses a fresh IV for every save', async () => {
    const { key } = await createVault(PASS);
    const [a, b] = await Promise.all([encryptJson(key, 'x', 1), encryptJson(key, 'x', 1)]);
    expect(a.iv).not.toBe(b.iv);
  });

  it('refuses a ciphertext moved onto another item id', async () => {
    const { key } = await createVault(PASS);
    const sealed = await encryptJson(key, 'id-1', 'secret');
    await expect(decryptJson(key, 'id-2', sealed)).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('refuses a wrong passcode', async () => {
    const { material } = await createVault(PASS);
    await expect(unlockWithPasscode(material, 'wrong passcode here')).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('refuses fewer than 600,000 iterations', async () => {
    const { material } = await createVault(PASS);
    await expect(unlockWithPasscode({ ...material, iterations: 599_999 }, PASS)).rejects.toBeInstanceOf(
      WeakSettingsError,
    );
  });

  it('makes a non-extractable key on create and unlock', async () => {
    const { material, key } = await createVault(PASS);
    expect(key.extractable).toBe(false);
    expect((await unlockWithPasscode(material, PASS)).extractable).toBe(false);
  });

  it('keeps items readable after a passcode change and rejects the old one', async () => {
    const { material, key } = await createVault(PASS);
    const sealed = await encryptJson(key, 'a', 'v');
    const wrap = await changePasscode(material, PASS, 'a brand new passcode');
    await expect(unlockWithPasscode(wrap, PASS)).rejects.toBeInstanceOf(WrongSecretError);
    const next = await unlockWithPasscode(wrap, 'a brand new passcode');
    await expect(decryptJson(next, 'a', sealed)).resolves.toBe('v');
  });

  it('refuses a passcode change with the wrong current passcode', async () => {
    const { material } = await createVault(PASS);
    await expect(changePasscode(material, 'not the passcode', 'a brand new passcode')).rejects.toBeInstanceOf(
      WrongSecretError,
    );
  });

  it('sets a new passcode from the recovery key', async () => {
    const { material, recoveryKey, key } = await createVault(PASS);
    const sealed = await encryptJson(key, 'a', 'v');
    const wrap = await recoverPasscode(material, recoveryKey, 'recovered passcode 1');
    const next = await unlockWithPasscode(wrap, 'recovered passcode 1');
    await expect(decryptJson(next, 'a', sealed)).resolves.toBe('v');
  });

  it('formats the recovery key as eight groups of four base-32 characters', async () => {
    const { recoveryKey } = await createVault(PASS);
    expect(recoveryKey).toMatch(/^[A-Z2-7]{4}(-[A-Z2-7]{4}){7}$/);
  });

  it('accepts a recovery key in lowercase, spaced or undashed', async () => {
    const { material, recoveryKey } = await createVault(PASS);
    for (const typed of [recoveryKey.toLowerCase(), recoveryKey.replaceAll('-', ' '), recoveryKey.replaceAll('-', '')]) {
      await expect(unlockWithRecoveryKey(material, typed)).resolves.toBeDefined();
    }
  });

  it('refuses a wrong or malformed recovery key', async () => {
    const { material } = await createVault(PASS);
    await expect(unlockWithRecoveryKey(material, 'AAAA-BBBB')).rejects.toBeInstanceOf(WrongSecretError);
    await expect(unlockWithRecoveryKey(material, 'A'.repeat(32))).rejects.toBeInstanceOf(WrongSecretError);
  });

  it('stops accepting a replaced recovery key', async () => {
    const { material, recoveryKey } = await createVault(PASS);
    const replaced = await replaceRecoveryKey(material, PASS);
    await expect(unlockWithRecoveryKey(replaced, recoveryKey)).rejects.toBeInstanceOf(WrongSecretError);
    await expect(unlockWithRecoveryKey(replaced, replaced.recoveryKey)).resolves.toBeDefined();
  });

  it('treats composed and decomposed passcodes as the same', async () => {
    const { material } = await createVault('café passcode 12');
    await expect(unlockWithPasscode(material, 'café passcode 12')).resolves.toBeDefined();
  });
});

it('opens a shared vault key with its sharing passcode or the owner vault key, and changes the passcode', async () => {
  const { key: vaultKey } = await createVault('owner passcode 1');
  const { wrap, key: spaceKey } = await createSpaceKey(vaultKey, 'sharing passcode 1');
  const sealed = await encryptJson(spaceKey, 'item-1', { secret: 42 });
  expect(await decryptJson(await unlockSpaceWithPasscode(wrap, 'sharing passcode 1'), 'item-1', sealed)).toEqual({ secret: 42 });
  expect(await decryptJson(await unlockSpaceAsOwner(wrap.ownerWrappedKey, vaultKey), 'item-1', sealed)).toEqual({ secret: 42 });
  await expect(unlockSpaceWithPasscode(wrap, 'owner passcode 1')).rejects.toBeInstanceOf(WrongSecretError);

  const changed = await changeSpacePasscode(wrap.ownerWrappedKey, vaultKey, 'new sharing pass');
  expect(await decryptJson(await unlockSpaceWithPasscode(changed, 'new sharing pass'), 'item-1', sealed)).toEqual({ secret: 42 });
  await expect(unlockSpaceWithPasscode(changed, 'sharing passcode 1')).rejects.toBeInstanceOf(WrongSecretError);
  const { key: otherVault } = await createVault('another person 1');
  await expect(unlockSpaceAsOwner(wrap.ownerWrappedKey, otherVault)).rejects.toBeInstanceOf(WrongSecretError);
});
