import { expect, it } from 'vitest';
import { itemSummary, matchesSearch } from './item-content';
import type { ItemContent, ItemField, ItemType } from './vault-types';

const field = (label: string, value: string): ItemField => ({ label, value, secret: false });
const item = (type: ItemType, fields: ItemField[]): ItemContent => ({ version: 1, type, name: 'N', fields, notes: '' });

it.each([
  ['card', [field('Card number', '4242 4242 4242 4242')], 'Ending 4242'],
  ['id', [field('Expiry date', '14 Mar 2031')], '14 Mar 2031'],
  ['login', [field('Username', 'sam')], 'sam'],
  ['key', [field('Service', 'Maps')], 'Maps'],
  ['other', [field('A', '1'), field('B', '2')], '2 fields'],
  ['other', [field('A', '1')], '1 field'],
])('summarises a %s', (type, fields, expected) => {
  expect(itemSummary(item(type as ItemType, fields))).toBe(expected);
});

it('summarises an item whose field is blank as nothing', () => {
  expect(itemSummary(item('card', [field('Card number', '')]))).toBe('');
});

it('searches name, type and summary but never secret values', () => {
  const card = { ...item('card', [{ label: 'CVV', value: '987', secret: true }]), name: 'Travel' };
  expect(matchesSearch(card, 'trav')).toBe(true);
  expect(matchesSearch(card, 'card')).toBe(true);
  expect(matchesSearch(card, '987')).toBe(false);
});
