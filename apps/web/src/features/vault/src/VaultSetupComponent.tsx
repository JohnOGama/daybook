'use client';

import { useQueryClient } from '@tanstack/react-query';
import { VaultIcon } from '@/shared/components/BrandIconsComponent';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { passcodeProblem } from './passcode-rules';
import { SecretFieldComponent, VaultGateComponent } from './VaultGateComponent';
import { saveNewVault } from './vault-api';
import { createVault } from './vault-crypto';

export function VaultSetupComponent({ onCreated }: { onCreated: (recoveryKey: string, key: CryptoKey) => void }) {
  const queryClient = useQueryClient();
  const [passcode, setPasscode] = useState('');
  const [repeated, setRepeated] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function create() {
    const problem = passcodeProblem(passcode, repeated);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      const { material, recoveryKey, key } = await createVault(passcode);
      await saveNewVault(material);
      queryClient.setQueryData(['vault'], material);
      onCreated(recoveryKey, key);
    } catch (failure) {
      setError((failure as Error).message);
      setBusy(false);
    }
  }

  return (
    <VaultGateComponent
      icon={VaultIcon}
      title="Set a vault passcode"
      description="Everything in this vault is encrypted in your browser with this passcode. It's separate from your Daybook password."
      error={error}
      onSubmit={create}
    >
      <SecretFieldComponent id="vault-passcode" label="Passcode" value={passcode} onChange={setPasscode} />
      <SecretFieldComponent id="vault-repeat" label="Type it again" value={repeated} onChange={setRepeated} />
      <div className="flex items-start gap-2.5 rounded-lg border bg-card p-3">
        <Checkbox
          id="vault-acknowledge"
          className="mt-0.5"
          checked={acknowledged}
          onCheckedChange={(checked) => setAcknowledged(checked === true)}
        />
        <Label htmlFor="vault-acknowledge" className="block text-[13px] leading-snug font-normal">
          I understand that if I forget this passcode and lose my recovery key, nobody can recover what's in the vault.
        </Label>
      </div>
      <Button type="submit" disabled={!acknowledged || busy}>
        Create vault
      </Button>
    </VaultGateComponent>
  );
}
