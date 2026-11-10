import { ITEM_TYPES, type ItemContent } from './vault-types';

const SUMMARY_FIELD: Partial<Record<ItemContent['type'], string>> = {
  id: 'Expiry date',
  login: 'Username',
  key: 'Service',
};

const valueOf = (content: ItemContent, label: string) =>
  content.fields.find((field) => field.label === label)?.value.trim() ?? '';

export function itemSummary(content: ItemContent): string {
  if (content.type === 'other') return `${content.fields.length} ${content.fields.length === 1 ? 'field' : 'fields'}`;
  if (content.type === 'card') {
    const digits = valueOf(content, 'Card number').replace(/\D/g, '');
    return digits ? `Ending ${digits.slice(-4)}` : '';
  }
  return valueOf(content, SUMMARY_FIELD[content.type] as string);
}

export function matchesSearch(content: ItemContent, query: string): boolean {
  const text = `${content.name} ${ITEM_TYPES[content.type].label} ${itemSummary(content)}`;
  return text.toLowerCase().includes(query.trim().toLowerCase());
}
