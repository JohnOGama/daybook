'use client';

import { LockKeyhole } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { PageSkeletonComponent } from '@/shared/components/PageSkeletonComponent';
import { Button } from '@/shared/components/ui/button';
import { useSpaceLock, useSpaceUnlocked } from '../hooks/useSpaceLock';
import { PasswordFieldComponent } from './PasswordFieldComponent';
import type { Space } from './space-types';

function LockScreen({ space }: { space: Space }) {
  const { unlock, removePassword } = useSpaceLock();
  const [forgot, setForgot] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const pending = unlock.isPending || removePassword.isPending;

  function switchMode(next: boolean) {
    setForgot(next);
    setPassword('');
    setError(undefined);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const onError = (failure: Error) => setError(failure.message);
    if (forgot) removePassword.mutate({ id: space.id, accountPassword: password }, { onError });
    else unlock.mutate({ id: space.id, password }, { onError });
  }

  return (
    <form
      key={space.id}
      onSubmit={handleSubmit}
      className="mx-auto flex min-h-[80dvh] w-full max-w-sm flex-col justify-center gap-4 px-6 py-10"
    >
      <span className="grid size-11 place-items-center rounded-xl border bg-card">
        <LockKeyhole className="size-5" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold tracking-tight">{forgot ? 'Remove the password' : `${space.title} is locked`}</h1>
      <p className="text-sm text-muted-foreground">
        {forgot
          ? 'Enter your Daybook account password to take the password off this space. Everything in it stays as it is.'
          : "Enter this space's password to open it."}
      </p>
      <PasswordFieldComponent
        key={String(forgot)}
        id="space-unlock-password"
        label={forgot ? 'Account password' : 'Password'}
        value={password}
        onChange={setPassword}
        autoFocus
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending || !password}>
        {forgot ? 'Remove password' : 'Unlock'}
      </Button>
      <Button type="button" variant="ghost" size="sm" className="self-center" onClick={() => switchMode(!forgot)}>
        {forgot ? 'Back' : 'Forgot the password?'}
      </Button>
    </form>
  );
}

export function SpaceLockGateComponent({ space, children }: { space: Space; children: ReactNode }) {
  const { data: unlocked, isPending, isError } = useSpaceUnlocked(space);

  if (isPending) return <PageSkeletonComponent />;
  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not check this space. Please try again.
      </p>
    );
  }
  return unlocked ? children : <LockScreen key={space.id} space={space} />;
}
