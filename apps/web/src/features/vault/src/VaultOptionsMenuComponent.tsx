'use client';

import { Download, KeyRound, MoreVertical, Pencil, Share2, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useToday } from '@/shared/hooks/useToday';
import { useVault } from '../hooks/useVault';
import { useVaultSession } from '../hooks/useVaultSession';
import { useVaultSpaceKey } from '../hooks/useVaultSpaceKey';
import { ChangePasscodeDialogComponent } from './ChangePasscodeDialogComponent';
import { downloadFile } from '@/shared/utils/download-file';
import { NewRecoveryKeyDialogComponent } from './NewRecoveryKeyDialogComponent';
import { SharingPasscodeDialogComponent } from './SharingPasscodeDialogComponent';
import { backupFileName, buildBackup, sealForImport } from './vault-backup';
import type { ItemContent, VaultItem, VaultRecord } from './vault-types';

type VaultOptionsMenuProps = {
  spaceId: string;
  items: VaultItem[];
  records: VaultRecord[];
  onImport: () => void;
  onRecoveryKey: (recoveryKey: string) => void;
};

export function VaultOptionsMenuComponent({ spaceId, items, records, onImport, onRecoveryKey }: VaultOptionsMenuProps) {
  const { data: material } = useVault();
  const { key } = useVaultSession();
  const { data: sharing } = useVaultSpaceKey(spaceId);
  const today = useToday();
  const [dialog, setDialog] = useState<'passcode' | 'recovery' | 'sharing'>();

  if (!material) return null;

  // A backup opens with the owner's own passcode, so a shared Vault's items are sealed again with the owner's key first.
  async function exportBackup() {
    if (!material) return;
    const contents = items.map(({ content }) => content).filter((content): content is ItemContent => content !== null);
    const sealed = sharing && key ? await sealForImport(key, contents) : records;
    const backup = buildBackup(material, sealed.map((item) => ({ updatedAt: '', ...item })), new Date().toISOString());
    downloadFile(backupFileName(today), JSON.stringify(backup), 'application/json');
    toast.success('Backup downloaded, still encrypted.');
  }

  const closeDialog = (open: boolean) => {
    if (!open) setDialog(undefined);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Vault options">
            <MoreVertical aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={exportBackup}>
            <Download aria-hidden />
            Export backup
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onImport}>
            <Upload aria-hidden />
            Import backup
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('sharing')}>
            <Share2 aria-hidden />
            {sharing ? 'Change sharing passcode' : 'Sharing passcode'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('passcode')}>
            <Pencil aria-hidden />
            Change passcode
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog('recovery')}>
            <KeyRound aria-hidden />
            New recovery key
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SharingPasscodeDialogComponent spaceId={spaceId} open={dialog === 'sharing'} onOpenChange={closeDialog} />
      <ChangePasscodeDialogComponent material={material} open={dialog === 'passcode'} onOpenChange={closeDialog} />
      <NewRecoveryKeyDialogComponent
        material={material}
        open={dialog === 'recovery'}
        onOpenChange={closeDialog}
        onCreated={onRecoveryKey}
      />
    </>
  );
}
