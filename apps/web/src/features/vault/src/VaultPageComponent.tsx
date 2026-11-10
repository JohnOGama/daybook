'use client';

import { useState } from 'react';
import { useActiveSpace } from '@/features/spaces';
import { PageSkeletonComponent } from '@/shared/components/PageSkeletonComponent';
import { useVault } from '../hooks/useVault';
import { useVaultSession } from '../hooks/useVaultSession';
import { RecoveryKeyComponent } from './RecoveryKeyComponent';
import { VaultLockedComponent } from './VaultLockedComponent';
import { VaultRecoverComponent } from './VaultRecoverComponent';
import { VaultSetupComponent } from './VaultSetupComponent';
import { VaultUnlockedComponent } from './VaultUnlockedComponent';

export function VaultPageComponent() {
  const space = useActiveSpace();
  const { data: material, isPending, isError } = useVault();
  const { key, unlock } = useVaultSession();
  const [created, setCreated] = useState<{ recoveryKey: string; key: CryptoKey }>();
  const [recovering, setRecovering] = useState(false);

  if (!globalThis.crypto?.subtle) {
    return (
      <div className="px-6 py-16 text-center">
        <h1 className="text-base font-semibold">The vault needs a secure connection</h1>
        <p className="mt-1 text-sm text-muted-foreground">Open Daybook over HTTPS or on localhost to use it.</p>
      </div>
    );
  }
  if (isPending) return <PageSkeletonComponent />;
  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load your vault. Please try again.
      </p>
    );
  }
  if (created) {
    return (
      <RecoveryKeyComponent
        recoveryKey={created.recoveryKey}
        onDone={() => {
          unlock(created.key);
          setCreated(undefined);
        }}
      />
    );
  }
  if (!material) return <VaultSetupComponent onCreated={(recoveryKey, newKey) => setCreated({ recoveryKey, key: newKey })} />;
  if (!key) {
    return recovering ? (
      <VaultRecoverComponent material={material} onBack={() => setRecovering(false)} />
    ) : (
      <VaultLockedComponent title={space?.title ?? 'Vault'} material={material} onForgot={() => setRecovering(true)} />
    );
  }
  return <VaultUnlockedComponent key={space?.id} spaceId={space?.id ?? ''} spaceTitle={space?.title ?? 'Vault'} />;
}
