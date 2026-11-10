'use client';

import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { useVaultSession } from '../hooks/useVaultSession';
import { SecretFieldComponent, VaultGateComponent } from './VaultGateComponent';
import { unlockWithPasscode, type VaultMaterial, WrongSecretError } from './vault-crypto';

export function VaultLockedComponent({
  title,
  material,
  onForgot,
}: {
  title: string;
  material: VaultMaterial;
  onForgot: () => void;
}) {
  const { unlock } = useVaultSession();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    setError(undefined);
    try {
      unlock(await unlockWithPasscode(material, passcode));
    } catch (failure) {
      setError(failure instanceof WrongSecretError ? 'That passcode is not right.' : (failure as Error).message);
      setPasscode('');
      setBusy(false);
    }
  }

  return (
    <VaultGateComponent icon={Lock} title={`${title} is locked`} error={error} onSubmit={open}>
      <SecretFieldComponent id="vault-unlock" label="Passcode" value={passcode} onChange={setPasscode} />
      <Button type="submit" disabled={busy || passcode === ''}>
        Unlock
      </Button>
      <Button type="button" variant="link" className="self-center text-muted-foreground" onClick={onForgot}>
        Forgot passcode?
      </Button>
    </VaultGateComponent>
  );
}
