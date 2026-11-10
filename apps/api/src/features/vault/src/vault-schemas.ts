import { z } from 'zod';

const MIN_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const WRAPPED_KEY_BYTES = 60;
const IV_BYTES = 12;
const MAX_CIPHERTEXT_BYTES = 64 * 1024;
const MAX_IMPORT_ITEMS = 2000;

const base64 = (accepts: (bytes: number) => boolean) =>
  z.string().refine((value) => {
    const decoded = Buffer.from(value, 'base64');
    return decoded.toString('base64') === value && accepts(decoded.length);
  }, 'Invalid encoded value');

const exactBytes = (expected: number) => base64((bytes) => bytes === expected);
const salt = exactBytes(SALT_BYTES);
const wrappedKey = exactBytes(WRAPPED_KEY_BYTES);
const payload = {
  iv: exactBytes(IV_BYTES),
  ciphertext: base64((bytes) => bytes > 0 && bytes <= MAX_CIPHERTEXT_BYTES),
};

export const passcodeWrapSchema = z.object({ salt, iterations: z.int().min(MIN_ITERATIONS), wrappedKey });
export const recoveryWrapSchema = z.object({ recoverySalt: salt, recoveryWrappedKey: wrappedKey });
export const createVaultSchema = z.object({ ...passcodeWrapSchema.shape, ...recoveryWrapSchema.shape });

export const listItemsSchema = z.object({ spaceId: z.uuid() });
export const createItemSchema = z.object({ id: z.uuid(), spaceId: z.uuid(), ...payload });
export const updateItemSchema = z.object(payload);
export const importItemsSchema = z.object({
  spaceId: z.uuid(),
  items: z.array(z.object({ id: z.uuid(), ...payload })).max(MAX_IMPORT_ITEMS),
});

export type PasscodeWrap = z.infer<typeof passcodeWrapSchema>;
export type RecoveryWrap = z.infer<typeof recoveryWrapSchema>;
export type VaultDto = z.infer<typeof createVaultSchema>;
export type ItemPayload = z.infer<typeof updateItemSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type ImportItemsInput = z.infer<typeof importItemsSchema>;
