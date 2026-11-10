'use client';

import { Copy, Download, KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { copyWithToast } from './copy-secret';
import { downloadFile } from './download-file';
import { VaultGateComponent } from './VaultGateComponent';

export function RecoveryKeyComponent({ recoveryKey, onDone }: { recoveryKey: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false);

  return (
    <VaultGateComponent
      icon={KeyRound}
      title="Save your recovery key"
      description="If you forget your passcode, this is the only way back in. You'll only see it this once."
      onSubmit={onDone}
    >
      <p className="rounded-lg border bg-card p-3.5 text-center font-mono text-[15px] leading-relaxed tracking-wide">
        {recoveryKey}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" onClick={() => copyWithToast(recoveryKey)}>
          <Copy aria-hidden />
          Copy
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => downloadFile('daybook-vault-recovery-key.txt', recoveryKey, 'text/plain')}
        >
          <Download aria-hidden />
          Download
        </Button>
      </div>
      <div className="flex items-start gap-2.5 rounded-lg border bg-card p-3">
        <Checkbox
          id="vault-key-saved"
          className="mt-0.5"
          checked={saved}
          onCheckedChange={(checked) => setSaved(checked === true)}
        />
        <Label htmlFor="vault-key-saved" className="block text-[13px] leading-snug font-normal">
          I've saved it somewhere outside Daybook.
        </Label>
      </div>
      <Button type="submit" disabled={!saved}>
        Continue
      </Button>
    </VaultGateComponent>
  );
}
