'use client';

import { useState } from 'react';
import { VaultIcon } from '@/shared/components/BrandIconsComponent';
import { Button } from '@/shared/components/ui/button';
import { useVaultSession } from '../hooks/useVaultSession';
import { SecretFieldComponent, VaultGateComponent } from './VaultGateComponent';
import { type PasscodeWrap, unlockSpaceWithPasscode, WrongSecretError } from './vault-crypto';

type VaultSharedLockedProps = { spaceId: string; title: string; ownerName: string | null; wrap: PasscodeWrap };

// Someone a Vault is shared with opens it with its sharing passcode, which the owner gives them.
export function VaultSharedLockedComponent({ spaceId, title, ownerName, wrap }: VaultSharedLockedProps) {
  const { unlockSpace } = useVaultSession();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    setError(undefined);
    try {
      unlockSpace?.(spaceId, await unlockSpaceWithPasscode(wrap, passcode));
    } catch (failure) {
      setError(failure instanceof WrongSecretError ? 'That sharing passcode is not right.' : (failure as Error).message);
      setPasscode('');
      setBusy(false);
    }
  }

  return (
    <VaultGateComponent
      icon={VaultIcon}
      title={`${title} is locked`}
      description={`Ask ${ownerName ?? 'the owner'} for this vault's sharing passcode.`}
      error={error}
      onSubmit={open}
    >
      <SecretFieldComponent id="vault-shared-unlock" label="Sharing passcode" value={passcode} onChange={setPasscode} />
      <Button type="submit" disabled={busy || passcode === ''}>
        Unlock
      </Button>
    </VaultGateComponent>
  );
}
