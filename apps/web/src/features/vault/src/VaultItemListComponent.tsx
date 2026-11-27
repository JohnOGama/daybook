'use client';

import { FileWarning, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/utils/cn';
import { ITEM_ICONS } from './item-icons';
import { itemSummary, matchesSearch } from './item-content';
import { ITEM_TYPES, type VaultItem } from './vault-types';

type VaultItemListProps = {
  title: string;
  items: VaultItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  onAdd?: () => void;
};

function ItemRow({ item, isActive, onSelect }: { item: VaultItem; isActive: boolean; onSelect: () => void }) {
  const { content } = item;
  const Icon = content ? ITEM_ICONS[content.type] : FileWarning;
  const details = content ? [ITEM_TYPES[content.type].label, itemSummary(content)].filter(Boolean).join(' · ') : '';

  return (
    <li>
      <button
        type="button"
        aria-current={isActive ? 'true' : undefined}
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-accent',
          isActive && 'bg-muted',
        )}
      >
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{content?.name ?? "Can't read this item"}</span>
          {details && <span className="block truncate text-xs text-muted-foreground">{details}</span>}
        </span>
      </button>
    </li>
  );
}

export function VaultItemListComponent({ title, items, activeId, onSelect, onAdd }: VaultItemListProps) {
  const [query, setQuery] = useState('');
  const shown = items.filter((item) => !query || (item.content !== null && matchesSearch(item.content, query)));

  return (
    <section aria-label="Vault items" className="flex flex-col gap-2 p-3">
      <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2">
        <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        <span className="shrink-0 text-[13px] text-muted-foreground">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      {onAdd && (
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus aria-hidden />
          Add item
        </Button>
      )}
      <div className="relative">
        <Search className="absolute top-2.5 left-2.5 size-3.5 text-muted-foreground" aria-hidden />
        <Input
          aria-label="Search the vault"
          placeholder="Search"
          autoComplete="off"
          className="pl-8"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {shown.length === 0 && query !== '' && <p className="px-2.5 py-2 text-[13px] text-muted-foreground">No items match.</p>}
      <ul className="flex flex-col gap-0.5">
        {shown.map((item) => (
          <ItemRow key={item.id} item={item} isActive={item.id === activeId} onSelect={() => onSelect(item.id)} />
        ))}
      </ul>
    </section>
  );
}
