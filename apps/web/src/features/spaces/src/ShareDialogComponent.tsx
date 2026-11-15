'use client';

import { X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useShares } from '../hooks/useShares';
import type { Share, ShareRole, Space } from './space-types';

const ROLES: { value: ShareRole; label: string }[] = [
  { value: 'edit', label: 'Can edit' },
  { value: 'view', label: 'Can view' },
];

const SAMPLE_SHARES: Share[] = ['teammate@example.com', 'friend@example.com'].map((email, index) => ({
  id: `sample-${index}`,
  email,
  role: 'edit',
}));

type RoleSelectProps = { label: string; value: ShareRole; onChange: (role: ShareRole) => void };

function RoleSelect({ label, value, onChange }: RoleSelectProps) {
  return (
    <Select value={value} onValueChange={(role) => onChange(role as ShareRole)}>
      <SelectTrigger aria-label={label} size="sm" className="w-28 shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((role) => (
          <SelectItem key={role.value} value={role.value}>
            {role.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SharePanel({ spaceId }: { spaceId: string }) {
  const { data, isPending, isError, add, setRole, remove } = useShares(spaceId);
  const [email, setEmail] = useState('');
  const [role, setInviteRole] = useState<ShareRole>('edit');
  const shares = isPending ? SAMPLE_SHARES : (data ?? []);

  function invite(event: FormEvent) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!address) return;
    const existing = data?.find((share) => share.email === address);
    if (!existing) add.mutate({ id: crypto.randomUUID(), email: address, role });
    else if (existing.role !== role) setRole.mutate({ shareId: existing.id, role });
    setEmail('');
  }

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={invite} className="flex items-center gap-2">
        <Label htmlFor="share-email" className="sr-only">
          Email
        </Label>
        <Input
          id="share-email"
          type="email"
          required
          autoComplete="off"
          placeholder="name@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-w-0 flex-1"
        />
        <RoleSelect label="Role for the invite" value={role} onChange={setInviteRole} />
        <Button type="submit" disabled={isPending || isError}>
          Invite
        </Button>
      </form>

      {isError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load who this is shared with. Please try again.
        </p>
      ) : !isPending && shares.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
          Only you can see this.
        </p>
      ) : (
        <Skeleton loading={isPending} label="Loading people">
          <ul aria-label="People with access" className="flex flex-col gap-1.5">
            {shares.map((share) => (
              <li key={share.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{share.email}</span>
                <RoleSelect
                  label={`Role for ${share.email}`}
                  value={share.role}
                  onChange={(next) => setRole.mutate({ shareId: share.id, role: next })}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${share.email}`}
                  onClick={() => remove.mutate(share.id)}
                >
                  <X aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </Skeleton>
      )}
    </div>
  );
}

type ShareDialogProps = { space: Space; open: boolean; onOpenChange: (open: boolean) => void };

export function ShareDialogComponent({ space, open, onOpenChange }: ShareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share &quot;{space.title}&quot;</DialogTitle>
          <DialogDescription>
            It shows under Shared with me for anyone who signs in with an email you invite.
          </DialogDescription>
        </DialogHeader>
        <SharePanel spaceId={space.id} />
      </DialogContent>
    </Dialog>
  );
}
