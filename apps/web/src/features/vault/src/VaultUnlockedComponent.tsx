'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from 'skullet/react';
import { EmptyStateComponent } from '@/shared/components/EmptyStateComponent';
import { EmptyVaultIcon } from '@/shared/components/EmptyStateIconsComponent';
import { Button } from '@/shared/components/ui/button';
import { useVaultItems } from '../hooks/useVaultItems';
import { useVaultSession } from '../hooks/useVaultSession';
import { RecoveryKeyComponent } from './RecoveryKeyComponent';
import { VaultImportComponent } from './VaultImportComponent';
import { VaultItemDetailComponent } from './VaultItemDetailComponent';
import { VaultItemFormComponent } from './VaultItemFormComponent';
import { VaultItemListComponent } from './VaultItemListComponent';
import { VaultOptionsMenuComponent } from './VaultOptionsMenuComponent';
import type { ItemContent, VaultItem } from './vault-types';

type Pane = 'view' | 'add' | 'edit' | 'import' | 'recovery-key';

const SAMPLE_ITEMS: VaultItem[] = ['Travel card', 'Passport', 'Work email'].map((name, index) => ({
  id: `sample-${index}`,
  updatedAt: '2026-01-15T12:00:00.000Z',
  content: { version: 1, type: 'other', name, fields: [], notes: '' },
}));

type VaultUnlockedProps = { spaceId: string; spaceTitle: string; canEdit: boolean; isOwner: boolean };

// `isOwner` false is someone the Vault is shared with: no backups, passcodes or recovery key, which are the owner's.
export function VaultUnlockedComponent({ spaceId, spaceTitle, canEdit, isOwner }: VaultUnlockedProps) {
  const { lock } = useVaultSession();
  const { items, records, isError, save, remove } = useVaultItems(spaceId);
  const [pane, setPane] = useState<Pane>('view');
  const [selectedId, setSelectedId] = useState<string>();
  const [newRecoveryKey, setNewRecoveryKey] = useState<string>();
  const isLoading = items === undefined && !isError;
  const shownItems = items ?? SAMPLE_ITEMS;
  const selected = shownItems.find(({ id }) => id === selectedId) ?? shownItems[0];

  function select(id: string) {
    setSelectedId(id);
    setPane('view');
  }

  async function handleSave(content: ItemContent) {
    const id = await save(pane === 'edit' ? (selected?.id ?? null) : null, content);
    toast.success('Item saved');
    select(id);
  }

  function handleDelete() {
    if (!selected) return;
    remove(selected.id);
    setSelectedId(undefined);
  }

  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load this vault. Please try again.
      </p>
    );
  }

  return (
    <div className="flex flex-col md:flex-row">
      <aside className="shrink-0 border-b md:sticky md:top-0 md:h-[calc(100dvh-1rem)] md:w-72 md:overflow-y-auto md:border-r md:border-b-0">
        <Skeleton loading={isLoading} label="Loading vault items">
          <VaultItemListComponent
            title={spaceTitle}
            items={shownItems}
            activeId={pane === 'view' ? selected?.id : undefined}
            onSelect={select}
            onAdd={canEdit ? () => setPane('add') : undefined}
          />
        </Skeleton>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-end gap-2 px-4 pt-3 text-[13px] text-muted-foreground">
          <span className="hidden sm:inline">Locks after 5 minutes idle</span>
          <Button variant="outline" size="sm" onClick={lock}>
            <Lock aria-hidden />
            Lock now
          </Button>
          {isOwner && (
            <VaultOptionsMenuComponent
              spaceId={spaceId}
              items={items ?? []}
              records={records ?? []}
            onImport={() => setPane('import')}
              onRecoveryKey={(recoveryKey) => {
                setNewRecoveryKey(recoveryKey);
                setPane('recovery-key');
              }}
            />
          )}
        </div>

        {!isLoading && pane === 'view' && selected && (
          <VaultItemDetailComponent
            key={selected.id}
            item={selected}
            onEdit={canEdit ? () => setPane('edit') : undefined}
            onDelete={canEdit ? handleDelete : undefined}
          />
        )}
        {!isLoading && pane === 'view' && !selected && (
          <EmptyStateComponent
            icon={<EmptyVaultIcon />}
            title="This vault is empty"
            description="Add a card, an ID, a login or a key. It's encrypted before it leaves your browser."
            action={canEdit && <Button onClick={() => setPane('add')}>Add item</Button>}
          />
        )}
        {pane === 'import' && <VaultImportComponent spaceId={spaceId} onDone={() => setPane('view')} />}
        {pane === 'recovery-key' && newRecoveryKey && (
          <RecoveryKeyComponent
            recoveryKey={newRecoveryKey}
            onDone={() => {
              setNewRecoveryKey(undefined);
              setPane('view');
            }}
          />
        )}
        {pane === 'add' && <VaultItemFormComponent onSave={handleSave} onCancel={() => setPane('view')} />}
        {pane === 'edit' && selected?.content && (
          <VaultItemFormComponent
            key={selected.id}
            initial={selected.content}
            onSave={handleSave}
            onCancel={() => setPane('view')}
          />
        )}
      </div>
    </div>
  );
}
