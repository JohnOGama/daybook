import type { ComponentProps } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

export function AuthFieldComponent({
  label,
  id,
  ...inputProps
}: ComponentProps<typeof Input> & { label: string; id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} required {...inputProps} />
    </div>
  );
}
