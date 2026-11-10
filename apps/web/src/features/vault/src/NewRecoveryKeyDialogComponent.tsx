'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { SecretFieldComponent } from './VaultGateComponent';
import { saveRecoveryWrap } from './vault-api';
import { replaceRecoveryKey, type VaultMaterial, WrongSecretError } from './vault-crypto';

type NewRecoveryKeyDialogProps = {
  material: VaultMaterial;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (recoveryKey: string) => void;
};

export function NewRecoveryKeyDialogComponent({ material, open, onOpenChange, onCreated }: NewRecoveryKeyDialogProps) {
  const queryClient = useQueryClient();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function close(nextOpen: boolean) {
    setPasscode('');
    setError(undefined);
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const { recoveryKey, ...wrap } = await replaceRecoveryKey(material, passcode);
      await saveRecoveryWrap(wrap);
      queryClient.setQueryData(['vault'], { ...material, ...wrap });
      close(false);
      onCreated(recoveryKey);
    } catch (failure) {
      setError(failure instanceof WrongSecretError ? 'That passcode is not right.' : (failure as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New recovery key</DialogTitle>
            <DialogDescription>Your old recovery key will stop working. Backups you already made keep theirs.</DialogDescription>
          </DialogHeader>
          <SecretFieldComponent id="vault-confirm-passcode" label="Passcode" value={passcode} onChange={setPasscode} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy || passcode === ''}>
              Make new key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
