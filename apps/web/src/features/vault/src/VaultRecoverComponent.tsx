'use client';

import { useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { useVaultSession } from '../hooks/useVaultSession';
import { EraseVaultDialogComponent } from './EraseVaultDialogComponent';
import { passcodeProblem } from './passcode-rules';
import { SecretFieldComponent, VaultGateComponent } from './VaultGateComponent';
import { savePasscodeWrap } from './vault-api';
import { recoverPasscode, unlockWithPasscode, type VaultMaterial, WrongSecretError } from './vault-crypto';

export function VaultRecoverComponent({ material, onBack }: { material: VaultMaterial; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { unlock } = useVaultSession();
  const [recoveryKey, setRecoveryKey] = useState('');
  const [passcode, setPasscode] = useState('');
  const [repeated, setRepeated] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [erasing, setErasing] = useState(false);

  async function recover() {
    const problem = passcodeProblem(passcode, repeated);
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      const wrap = await recoverPasscode(material, recoveryKey, passcode);
      await savePasscodeWrap(wrap);
      const updated = { ...material, ...wrap };
      queryClient.setQueryData(['vault'], updated);
      unlock(await unlockWithPasscode(updated, passcode));
      toast.success('New passcode set. Your items are all still here.');
      onBack();
    } catch (failure) {
      setError(failure instanceof WrongSecretError ? 'That recovery key is not right.' : (failure as Error).message);
      setBusy(false);
    }
  }

  return (
    <VaultGateComponent
      icon={KeyRound}
      title="Recover your vault"
      description="Enter your recovery key and choose a new passcode. Everything in the vault stays as it is."
      error={error}
      onSubmit={recover}
    >
      <SecretFieldComponent
        id="vault-recovery-key"
        label="Recovery key"
        type="text"
        placeholder="XXXX-XXXX-XXXX-XXXX-..."
        value={recoveryKey}
        onChange={setRecoveryKey}
      />
      <SecretFieldComponent id="vault-new-passcode" label="New passcode" value={passcode} onChange={setPasscode} />
      <SecretFieldComponent id="vault-repeat" label="Type it again" value={repeated} onChange={setRepeated} />
      <Button type="submit" disabled={busy || recoveryKey === ''}>
        Set new passcode
      </Button>
      <Button type="button" variant="link" className="self-center text-muted-foreground" onClick={onBack}>
        Back to unlock
      </Button>
      <Button type="button" variant="link" className="self-center text-muted-foreground" onClick={() => setErasing(true)}>
        Lost your recovery key too?
      </Button>
      <EraseVaultDialogComponent open={erasing} onOpenChange={setErasing} />
    </VaultGateComponent>
  );
}
