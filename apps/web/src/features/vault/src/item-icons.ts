import { CreditCard, FileText, IdCard, KeyRound, type LucideIcon, UserRound } from 'lucide-react';
import type { ItemType } from './vault-types';

export const ITEM_ICONS: Record<ItemType, LucideIcon> = {
  card: CreditCard,
  id: IdCard,
  login: UserRound,
  key: KeyRound,
  other: FileText,
};
