'use client';

import { useState } from 'react';
import { useActiveSpace, useSpaceAccess } from '@/features/spaces';
import { PageSkeletonComponent } from '@/shared/components/PageSkeletonComponent';
import { useVault } from '../hooks/useVault';
import { useVaultSession } from '../hooks/useVaultSession';
import { useVaultSpaceKey } from '../hooks/useVaultSpaceKey';
import { RecoveryKeyComponent } from './RecoveryKeyComponent';
import { VaultLockedComponent } from './VaultLockedComponent';
import { VaultRecoverComponent } from './VaultRecoverComponent';
import { VaultSetupComponent } from './VaultSetupComponent';
import { VaultSharedLockedComponent } from './VaultSharedLockedComponent';
import { VaultUnlockedComponent } from './VaultUnlockedComponent';

export function VaultPageComponent() {
  const space = useActiveSpace();
  const { data: material, isPending, isError } = useVault();
  const { key, spaceKeys = {}, unlock } = useVaultSession();
  const { isOwner, canEdit } = useSpaceAccess();
  const spaceId = space?.id ?? '';
  const sharing = useVaultSpaceKey(isOwner ? '' : spaceId);
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
  if (!isOwner) {
    if (sharing.isPending) return <PageSkeletonComponent />;
    if (sharing.isError || !sharing.data) {
      return (
        <p role="alert" className="px-6 py-8 text-sm text-destructive">
          Could not load this vault. Please try again.
        </p>
      );
    }
    if (!spaceKeys[spaceId]) {
      return <VaultSharedLockedComponent spaceId={spaceId} title={space?.title ?? 'Vault'} ownerName={space?.ownerName ?? null} wrap={sharing.data} />;
    }
    return <VaultUnlockedComponent key={spaceId} spaceId={spaceId} spaceTitle={space?.title ?? 'Vault'} canEdit={canEdit} isOwner={false} />;
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
  return <VaultUnlockedComponent key={spaceId} spaceId={spaceId} spaceTitle={space?.title ?? 'Vault'} canEdit isOwner />;
}
