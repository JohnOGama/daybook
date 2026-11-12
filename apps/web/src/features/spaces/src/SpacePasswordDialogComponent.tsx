'use client';

import { type FormEvent, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { useSpaceLock } from '../hooks/useSpaceLock';
import { PasswordFieldComponent } from './PasswordFieldComponent';
import type { Space } from './space-types';

export type PasswordDialogMode = 'add' | 'change' | 'remove';

const MIN_LENGTH = 4;

function PasswordForm({ space, mode, onDone }: { space: Space; mode: PasswordDialogMode; onDone: () => void }) {
  const { setPassword, removePassword } = useSpaceLock();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [useAccount, setUseAccount] = useState(false);
  const [error, setError] = useState<string>();
  const saving = setPassword.isPending || removePassword.isPending;
  const settle = { onSuccess: onDone, onError: (failure: Error) => setError(failure.message) };

  const copy = {
    add: {
      title: 'Add a password',
      description: `${space.title} will ask for this password before it opens. If you forget it, your Daybook account password can remove it.`,
      submit: 'Add password',
    },
    change: {
      title: 'Change password',
      description: `Enter the current password for ${space.title}, then choose a new one.`,
      submit: 'Save password',
    },
    remove: {
      title: 'Remove password',
      description: `${space.title} will open without asking for a password.`,
      submit: 'Remove password',
    },
  }[mode];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (mode === 'remove') {
      const proof = useAccount ? { accountPassword: current } : { password: current };
      removePassword.mutate({ id: space.id, ...proof }, settle);
      return;
    }
    if (next.length < MIN_LENGTH) return setError(`Use at least ${MIN_LENGTH} characters.`);
    if (next !== confirm) return setError('The two passwords do not match.');
    setPassword.mutate({ id: space.id, password: next, ...(mode === 'change' ? { currentPassword: current } : {}) }, settle);
  }

  function toggleAccount() {
    setUseAccount(!useAccount);
    setCurrent('');
    setError(undefined);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>
      </DialogHeader>

      {mode !== 'add' && (
        <div className="flex flex-col gap-2">
          <PasswordFieldComponent
            key={String(useAccount)}
            id="space-current-password"
            label={useAccount ? 'Account password' : 'Current password'}
            value={current}
            onChange={setCurrent}
            autoFocus
          />
          {mode === 'remove' && (
            <button
              type="button"
              onClick={toggleAccount}
              className="self-start text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {useAccount ? 'Use the space password instead' : 'Forgot it? Use your account password'}
            </button>
          )}
        </div>
      )}
      {mode !== 'remove' && (
        <>
          <PasswordFieldComponent
            id="space-new-password"
            label="New password"
            value={next}
            onChange={setNext}
            autoFocus={mode === 'add'}
            hint={`At least ${MIN_LENGTH} characters.`}
          />
          <PasswordFieldComponent id="space-confirm-password" label="Type it again" value={confirm} onChange={setConfirm} />
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant={mode === 'remove' ? 'destructive' : 'default'} disabled={saving}>
          {copy.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}

type SpacePasswordDialogProps = { space: Space; mode?: PasswordDialogMode; onClose: () => void };

export function SpacePasswordDialogComponent({ space, mode, onClose }: SpacePasswordDialogProps) {
  return (
    <Dialog open={mode !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {mode && <PasswordForm key={mode} space={space} mode={mode} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
