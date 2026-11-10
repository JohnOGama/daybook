'use client';

import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { passcodeProblem } from './passcode-rules';
import { SecretFieldComponent } from './VaultGateComponent';
import { savePasscodeWrap } from './vault-api';
import { changePasscode, type VaultMaterial, WrongSecretError } from './vault-crypto';

type ChangePasscodeDialogProps = {
  material: VaultMaterial;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChangePasscodeDialogComponent({ material, open, onOpenChange }: ChangePasscodeDialogProps) {
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeated, setRepeated] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function close(nextOpen: boolean) {
    setCurrent('');
    setNext('');
    setRepeated('');
    setError(undefined);
    onOpenChange(nextOpen);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = passcodeProblem(next, repeated);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      const wrap = await changePasscode(material, current, next);
      await savePasscodeWrap(wrap);
      queryClient.setQueryData(['vault'], { ...material, ...wrap });
      toast.success('Passcode changed');
      close(false);
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
            <DialogTitle>Change passcode</DialogTitle>
            <DialogDescription>Your items and your recovery key stay as they are.</DialogDescription>
          </DialogHeader>
          <SecretFieldComponent id="vault-current" label="Current passcode" value={current} onChange={setCurrent} />
          <SecretFieldComponent id="vault-next" label="New passcode" value={next} onChange={setNext} />
          <SecretFieldComponent id="vault-next-repeat" label="Type it again" value={repeated} onChange={setRepeated} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={busy || current === ''}>
              Change passcode
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
