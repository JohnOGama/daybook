import type { EncryptedPayload } from './vault-crypto';

export type ItemType = 'card' | 'id' | 'login' | 'key' | 'other';
export type ItemField = { label: string; value: string; secret: boolean };
export type ItemContent = { version: 1; type: ItemType; name: string; fields: ItemField[]; notes: string };

export type VaultRecord = EncryptedPayload & { id: string; updatedAt: string };
export type VaultItem = { id: string; updatedAt: string; content: ItemContent | null };

export const ITEM_TYPES: Record<ItemType, { label: string; fields: { label: string; secret: boolean }[] }> = {
  card: {
    label: 'Card',
    fields: [
      { label: 'Name on card', secret: false },
      { label: 'Card number', secret: true },
      { label: 'Expiry', secret: false },
      { label: 'CVV', secret: true },
    ],
  },
  id: {
    label: 'ID',
    fields: [
      { label: 'Kind of ID', secret: false },
      { label: 'Number', secret: true },
      { label: 'Expiry date', secret: false },
    ],
  },
  login: {
    label: 'Login',
    fields: [
      { label: 'Website', secret: false },
      { label: 'Username', secret: false },
      { label: 'Password', secret: true },
    ],
  },
  key: {
    label: 'Key',
    fields: [
      { label: 'Service', secret: false },
      { label: 'Key or secret', secret: true },
    ],
  },
  other: { label: 'Other', fields: [] },
};
