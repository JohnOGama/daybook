import {
  decryptJson,
  type EncryptedPayload,
  encryptJson,
  isRecoveryKey,
  MIN_ITERATIONS,
  unlockWithPasscode,
  unlockWithRecoveryKey,
  type VaultMaterial,
  WrongSecretError,
} from './vault-crypto';
import type { ItemContent, VaultRecord } from './vault-types';

const FORMAT = 'daybook-vault-backup';
const MAX_ITEMS = 2000;
const MAX_ITEM_BYTES = 64 * 1024;

export class InvalidBackupError extends Error {}

type BackupItem = EncryptedPayload & { id: string };

export type VaultBackup = {
  format: typeof FORMAT;
  version: 1;
  exportedAt: string;
  material: VaultMaterial;
  items: BackupItem[];
};

export const backupFileName = (date: string) => `${FORMAT}-${date}.json`;

export function buildBackup(material: VaultMaterial, records: VaultRecord[], exportedAt: string): VaultBackup {
  const items = records.map(({ id, iv, ciphertext }) => ({ id, iv, ciphertext }));
  return { format: FORMAT, version: 1, exportedAt, material, items };
}

const invalid = () => new InvalidBackupError('That file is not a valid Daybook vault backup.');
const isText = (value: unknown): value is string => typeof value === 'string';

function decodedLength(base64: string): number {
  try {
    return atob(base64).length;
  } catch {
    throw invalid();
  }
}

export function parseBackup(text: string): VaultBackup {
  let parsed: Partial<VaultBackup>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw invalid();
  }
  const { format, version, material, items } = parsed ?? {};
  if (format !== FORMAT || version !== 1 || !material || !Array.isArray(items)) throw invalid();
  const { salt, wrappedKey, recoverySalt, recoveryWrappedKey, iterations } = material;
  if (![salt, wrappedKey, recoverySalt, recoveryWrappedKey].every(isText)) throw invalid();
  if (typeof iterations !== 'number' || iterations < MIN_ITERATIONS || items.length > MAX_ITEMS) throw invalid();
  for (const item of items) {
    if (![item?.id, item?.iv, item?.ciphertext].every(isText)) throw invalid();
    if (decodedLength(item.ciphertext) > MAX_ITEM_BYTES) throw invalid();
  }
  return parsed as VaultBackup;
}

async function unlockBackup(material: VaultMaterial, secret: string) {
  if (isRecoveryKey(secret)) {
    try {
      return await unlockWithRecoveryKey(material, secret);
    } catch (error) {
      if (!(error instanceof WrongSecretError)) throw error;
    }
  }
  return unlockWithPasscode(material, secret);
}

export async function openBackup(backup: VaultBackup, secret: string): Promise<ItemContent[]> {
  const key = await unlockBackup(backup.material, secret);
  try {
    return await Promise.all(backup.items.map((item) => decryptJson<ItemContent>(key, item.id, item)));
  } catch {
    throw invalid();
  }
}

export function sealForImport(key: CryptoKey, contents: ItemContent[]): Promise<BackupItem[]> {
  return Promise.all(
    contents.map(async (content) => {
      const id = crypto.randomUUID();
      return { id, ...(await encryptJson(key, id, content)) };
    }),
  );
}
