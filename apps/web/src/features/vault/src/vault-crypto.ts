export const MIN_ITERATIONS = 600_000;
export const MIN_PASSCODE_LENGTH = 12;

export class WrongSecretError extends Error {}
export class WeakSettingsError extends Error {}

export type PasscodeWrap = { salt: string; iterations: number; wrappedKey: string };
export type RecoveryWrap = { recoverySalt: string; recoveryWrappedKey: string };
export type VaultMaterial = PasscodeWrap & RecoveryWrap;
export type EncryptedPayload = { iv: string; ciphertext: string };

const AES_GCM = { name: 'AES-GCM', length: 256 };
const IV_BYTES = 12;
const SALT_BYTES = 16;
const RECOVERY_BYTES = 20;
const RECOVERY_INFO = 'daybook-vault-recovery-v1';
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));
const bytesOf = (text: string) => new Uint8Array(encoder.encode(text));

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string) {
  return Uint8Array.from(atob(text), (character) => character.charCodeAt(0));
}

function encodeRecoveryKey(bytes: Uint8Array): string {
  let bits = '';
  for (const byte of bytes) bits += byte.toString(2).padStart(8, '0');
  const characters = bits.match(/.{5}/g)?.map((chunk) => BASE32[Number.parseInt(chunk, 2)]) ?? [];
  return characters.join('').match(/.{4}/g)?.join('-') ?? '';
}

function parseRecoveryKey(text: string) {
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z2-7]{32}$/.test(compact)) return null;
  let bits = '';
  for (const character of compact) bits += BASE32.indexOf(character).toString(2).padStart(5, '0');
  return Uint8Array.from(bits.match(/.{8}/g) ?? [], (chunk) => Number.parseInt(chunk, 2));
}

export const isRecoveryKey = (text: string) => parseRecoveryKey(text) !== null;

async function passcodeWrappingKey(passcode: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  if (iterations < MIN_ITERATIONS) throw new WeakSettingsError('This vault uses settings that are too weak.');
  const base = await crypto.subtle.importKey('raw', bytesOf(passcode.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, AES_GCM, false, [
    'wrapKey',
    'unwrapKey',
  ]);
}

async function recoveryWrappingKey(secret: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>) {
  const base = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: bytesOf(RECOVERY_INFO) },
    base,
    AES_GCM,
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

async function wrapVaultKey(vaultKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const iv = randomBytes(IV_BYTES);
  const wrapped = new Uint8Array(await crypto.subtle.wrapKey('raw', vaultKey, wrappingKey, { name: 'AES-GCM', iv }));
  return toBase64(new Uint8Array([...iv, ...wrapped]));
}

async function unwrapVaultKey(wrappedKey: string, wrappingKey: CryptoKey, extractable: boolean): Promise<CryptoKey> {
  try {
    const bytes = fromBase64(wrappedKey);
    return await crypto.subtle.unwrapKey(
      'raw',
      bytes.slice(IV_BYTES),
      wrappingKey,
      { name: 'AES-GCM', iv: bytes.slice(0, IV_BYTES) },
      AES_GCM,
      extractable,
      ['encrypt', 'decrypt'],
    );
  } catch {
    throw new WrongSecretError('That secret does not open this vault.');
  }
}

async function wrapWithPasscode(vaultKey: CryptoKey, passcode: string, iterations = MIN_ITERATIONS): Promise<PasscodeWrap> {
  const salt = randomBytes(SALT_BYTES);
  const wrappingKey = await passcodeWrappingKey(passcode, salt, iterations);
  return { salt: toBase64(salt), iterations, wrappedKey: await wrapVaultKey(vaultKey, wrappingKey) };
}

async function wrapWithNewRecoveryKey(vaultKey: CryptoKey): Promise<RecoveryWrap & { recoveryKey: string }> {
  const secret = randomBytes(RECOVERY_BYTES);
  const salt = randomBytes(SALT_BYTES);
  const wrappingKey = await recoveryWrappingKey(secret, salt);
  return {
    recoverySalt: toBase64(salt),
    recoveryWrappedKey: await wrapVaultKey(vaultKey, wrappingKey),
    recoveryKey: encodeRecoveryKey(secret),
  };
}

async function unwrapWithPasscode(wrap: PasscodeWrap, passcode: string, extractable: boolean) {
  const wrappingKey = await passcodeWrappingKey(passcode, fromBase64(wrap.salt), wrap.iterations);
  return unwrapVaultKey(wrap.wrappedKey, wrappingKey, extractable);
}

async function unwrapWithRecoveryKey(wrap: RecoveryWrap, recoveryKey: string, extractable: boolean) {
  const secret = parseRecoveryKey(recoveryKey);
  if (!secret) throw new WrongSecretError('That recovery key is not valid.');
  const wrappingKey = await recoveryWrappingKey(secret, fromBase64(wrap.recoverySalt));
  return unwrapVaultKey(wrap.recoveryWrappedKey, wrappingKey, extractable);
}

export async function createVault(passcode: string) {
  const vaultKey = await crypto.subtle.generateKey(AES_GCM, true, ['encrypt', 'decrypt']);
  const passcodeWrap = await wrapWithPasscode(vaultKey, passcode);
  const { recoveryKey, ...recoveryWrap } = await wrapWithNewRecoveryKey(vaultKey);
  const material: VaultMaterial = { ...passcodeWrap, ...recoveryWrap };
  return { material, recoveryKey, key: await unwrapWithPasscode(material, passcode, false) };
}

export const unlockWithPasscode = (wrap: PasscodeWrap, passcode: string) => unwrapWithPasscode(wrap, passcode, false);

export const unlockWithRecoveryKey = (wrap: RecoveryWrap, recoveryKey: string) =>
  unwrapWithRecoveryKey(wrap, recoveryKey, false);

export async function changePasscode(material: VaultMaterial, current: string, next: string): Promise<PasscodeWrap> {
  return wrapWithPasscode(await unwrapWithPasscode(material, current, true), next, material.iterations);
}

export async function recoverPasscode(material: VaultMaterial, recoveryKey: string, next: string): Promise<PasscodeWrap> {
  return wrapWithPasscode(await unwrapWithRecoveryKey(material, recoveryKey, true), next, material.iterations);
}

export async function replaceRecoveryKey(material: VaultMaterial, passcode: string) {
  return wrapWithNewRecoveryKey(await unwrapWithPasscode(material, passcode, true));
}

export async function encryptJson(key: CryptoKey, id: string, value: unknown): Promise<EncryptedPayload> {
  const iv = randomBytes(IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: bytesOf(id) },
    key,
    bytesOf(JSON.stringify(value)),
  );
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptJson<T>(key: CryptoKey, id: string, payload: EncryptedPayload): Promise<T> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(payload.iv), additionalData: bytesOf(id) },
      key,
      fromBase64(payload.ciphertext),
    );
    return JSON.parse(decoder.decode(plain)) as T;
  } catch {
    throw new WrongSecretError('This item could not be read.');
  }
}
