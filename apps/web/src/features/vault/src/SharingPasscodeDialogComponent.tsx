'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { useVaultSpaceKey } from '../hooks/useVaultSpaceKey';
import { useVaultSession } from '../hooks/useVaultSession';
import { passcodeProblem } from './passcode-rules';
import { SecretFieldComponent } from './VaultGateComponent';
import { fetchItems, saveSpaceKey } from './vault-api';
import { changeSpacePasscode, createSpaceKey, decryptJson, encryptJson } from './vault-crypto';

type SharingPasscodeDialogProps = { spaceId: string; open: boolean; onOpenChange: (open: boolean) => void };

// The owner sets the passcode people this Vault is shared with type to open it. The first time, the Vault gets its own
// key and every item, trashed ones too, is re-encrypted with it in the browser.
export function SharingPasscodeDialogComponent({ spaceId, open, onOpenChange }: SharingPasscodeDialogProps) {
  const queryClient = useQueryClient();
  const { key, unlockSpace } = useVaultSession();
  const { data: current } = useVaultSpaceKey(spaceId);
  const [next, setNext] = useState('');
  const [repeated, setRepeated] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const isNew = !current?.ownerWrappedKey;

  function close(nextOpen: boolean) {
    setNext('');
    setRepeated('');
    setError(undefined);
    onOpenChange(nextOpen);
  }

  async function firstSetup(vaultKey: CryptoKey) {
    const records = await fetchItems(spaceId, true);
    const contents = await Promise.all(records.map((record) => decryptJson(vaultKey, record.id, record))).catch(() => {
      throw new Error("An item in this vault can't be read, so it can't be shared yet.");
    });
    const { wrap, key: spaceKey } = await createSpaceKey(vaultKey, next);
    const items = await Promise.all(records.map(async ({ id }, index) => ({ id, ...(await encryptJson(spaceKey, id, contents[index])) })));
    await saveSpaceKey(spaceId, { ...wrap, items });
    unlockSpace?.(spaceId, spaceKey);
    queryClient.setQueryData(['vault-space-key', spaceId], wrap);
    await queryClient.invalidateQueries({ queryKey: ['vault-items', spaceId] });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = passcodeProblem(next, repeated);
    setError(problem);
    if (problem || !key) return;
    setBusy(true);
    try {
      if (isNew) {
        await firstSetup(key);
      } else {
        const wrap = await changeSpacePasscode(current.ownerWrappedKey as string, key, next);
        await saveSpaceKey(spaceId, wrap);
        queryClient.setQueryData(['vault-space-key', spaceId], wrap);
      }
      toast.success(isNew ? 'Sharing passcode set. You can share this vault now.' : 'Sharing passcode changed');
      close(false);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isNew ? 'Set a sharing passcode' : 'Change sharing passcode'}</DialogTitle>
            <DialogDescription>
              People you share this vault with type it to open it. Tell them yourself, not through Daybook. It only opens this vault,
              never your own passcode or your other vaults, and you keep opening it with your own passcode.
            </DialogDescription>
          </DialogHeader>
          <SecretFieldComponent id="vault-sharing" label="Sharing passcode" value={next} onChange={setNext} />
          <SecretFieldComponent id="vault-sharing-repeat" label="Type it again" value={repeated} onChange={setRepeated} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy || !key}>
              {isNew ? 'Set passcode' : 'Change passcode'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
