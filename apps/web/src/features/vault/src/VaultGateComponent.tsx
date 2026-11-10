'use client';

import type { LucideIcon } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

type VaultGateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  error?: string;
  onSubmit: () => void;
  children: ReactNode;
};

export function VaultGateComponent({ icon: Icon, title, description, error, onSubmit, children }: VaultGateProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex min-h-[80dvh] w-full max-w-sm flex-col justify-center gap-4 px-6 py-10">
      <span className="grid size-11 place-items-center rounded-xl border bg-card">
        <Icon className="size-5" aria-hidden />
      </span>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {children}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

type SecretFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'password' | 'text';
  placeholder?: string;
};

export function SecretFieldComponent({ id, label, value, onChange, type = 'password', placeholder }: SecretFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
