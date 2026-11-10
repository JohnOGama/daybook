'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { SecretFieldComponent } from './VaultGateComponent';
import { eraseVault } from './vault-api';

export function EraseVaultDialogComponent({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState('');

  async function erase() {
    try {
      await eraseVault();
      queryClient.setQueryData(['vault'], null);
      queryClient.removeQueries({ queryKey: ['vault-items'] });
      void queryClient.invalidateQueries({ queryKey: ['trash'] });
      toast.success('Vault erased');
    } catch (failure) {
      toast.error((failure as Error).message);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setTyped('');
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Erase this vault?</AlertDialogTitle>
          <AlertDialogDescription>
            Without your passcode or recovery key, nobody can open it. Erasing permanently deletes everything in it, including
            anything in Trash, and you can start again with a new passcode. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <SecretFieldComponent id="vault-erase" label="Type ERASE to confirm" type="text" value={typed} onChange={setTyped} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={typed !== 'ERASE'} onClick={erase}>
            Erase vault
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
