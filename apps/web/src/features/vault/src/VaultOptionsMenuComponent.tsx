'use client';

import { Download, KeyRound, MoreVertical, Pencil, Upload } from 'lucide-react';
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
import { ChangePasscodeDialogComponent } from './ChangePasscodeDialogComponent';
import { downloadFile } from '@/shared/utils/download-file';
import { NewRecoveryKeyDialogComponent } from './NewRecoveryKeyDialogComponent';
import { backupFileName, buildBackup } from './vault-backup';
import type { VaultRecord } from './vault-types';

type VaultOptionsMenuProps = {
  records: VaultRecord[];
  onImport: () => void;
  onRecoveryKey: (recoveryKey: string) => void;
};

export function VaultOptionsMenuComponent({ records, onImport, onRecoveryKey }: VaultOptionsMenuProps) {
  const { data: material } = useVault();
  const today = useToday();
  const [dialog, setDialog] = useState<'passcode' | 'recovery'>();

  if (!material) return null;

  function exportBackup() {
    if (!material) return;
    const backup = buildBackup(material, records, new Date().toISOString());
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
