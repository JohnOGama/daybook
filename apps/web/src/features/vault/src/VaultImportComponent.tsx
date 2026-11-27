'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useItemKey } from '../hooks/useVaultSpaceKey';
import { InvalidBackupError, openBackup, parseBackup, sealForImport } from './vault-backup';
import { importItems } from './vault-api';
import { WrongSecretError } from './vault-crypto';
import { SecretFieldComponent } from './VaultGateComponent';
import { VaultFieldRowComponent } from './VaultItemDetailComponent';
import { ITEM_TYPES, type ItemContent } from './vault-types';

export const MAX_IMPORT_BODY_BYTES = 8 * 1024 * 1024;

const countOf = (count: number) => `${count} ${count === 1 ? 'item' : 'items'}`;

function describeFailure(failure: unknown): string {
  if (failure instanceof WrongSecretError) return 'That passcode or recovery key is not right.';
  if (failure instanceof InvalidBackupError) return failure.message;
  return 'That backup could not be opened. Please try again.';
}

export function VaultImportComponent({ spaceId, onDone }: { spaceId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const key = useItemKey(spaceId);
  const [file, setFile] = useState<File>();
  const [secret, setSecret] = useState('');
  const [contents, setContents] = useState<ItemContent[]>();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleOpen(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (file.size > MAX_IMPORT_BODY_BYTES) {
      setError('That backup is too large to import at once. The limit is 8 MB.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      setContents(await openBackup(parseBackup(await file.text()), secret));
      setSecret('');
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!key || !contents) return;
    setBusy(true);
    setError(undefined);
    try {
      await importItems({ spaceId, items: await sealForImport(key, contents) });
      await queryClient.invalidateQueries({ queryKey: ['vault-items', spaceId] });
      toast.success(`Imported ${countOf(contents.length)}`);
      onDone();
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setRevealed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  const errorMessage = error && (
    <p role="alert" className="text-sm text-destructive">
      {error}
    </p>
  );

  if (!contents) {
    return (
      <article className="mx-auto max-w-[620px] px-4 pt-4 pb-16 md:px-8">
        <h2 className="text-2xl leading-tight font-semibold tracking-tight">Import a backup</h2>
        <p className="mt-2 text-sm text-muted-foreground">Works with a backup from this account or any other Daybook account.</p>
        <form onSubmit={handleOpen} className="mt-5 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vault-backup-file">Backup file</Label>
            <Input
              id="vault-backup-file"
              type="file"
              accept=".json,application/json"
              onChange={(event) => setFile(event.target.files?.[0])}
            />
          </div>
          <SecretFieldComponent
            id="vault-backup-secret"
            label="Passcode or recovery key from when it was exported"
            value={secret}
            onChange={setSecret}
          />
          {errorMessage}
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !file || secret === ''}>
              Open backup
            </Button>
          </div>
        </form>
      </article>
    );
  }

  return (
    <article className="mx-auto max-w-[620px] px-4 pt-4 pb-16 md:px-8">
      <h2 className="text-2xl leading-tight font-semibold tracking-tight">Backup contents</h2>
      <p className="text-[13px] text-muted-foreground">{countOf(contents.length)}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Have a look before bringing these in. They'll be added to this vault, and nothing here is replaced.
      </p>
      <ul className="mt-5 flex flex-col gap-4">
        {contents.map((content, itemIndex) => (
          <li key={`${content.name}-${itemIndex}`}>
            <p className="text-sm font-medium">{content.name}</p>
            <p className="text-xs text-muted-foreground">{ITEM_TYPES[content.type].label}</p>
            {content.fields.length > 0 && (
              <div className="mt-2 divide-y rounded-lg border">
                {content.fields.map((field, fieldIndex) => {
                  const id = `${itemIndex}:${fieldIndex}`;
                  return <VaultFieldRowComponent key={id} field={field} revealed={revealed.has(id)} onToggle={() => toggle(id)} />;
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-col gap-3">
        {errorMessage}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="button" disabled={busy || contents.length === 0} onClick={handleImport}>
            Import {countOf(contents.length)}
          </Button>
        </div>
      </div>
    </article>
  );
}
