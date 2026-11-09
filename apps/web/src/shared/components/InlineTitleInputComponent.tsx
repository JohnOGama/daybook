'use client';

import { type FocusEvent, type KeyboardEvent, useRef } from 'react';
import { Input } from '@/shared/components/ui/input';

type InlineTitleInputProps = {
  label: string;
  value: string;
  onSave: (title: string) => void;
  onClose: () => void;
};

export function InlineTitleInputComponent({ label, value, onSave, onClose }: InlineTitleInputProps) {
  const cancelled = useRef(false);

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const title = event.target.value.trim();
    onClose();
    if (!cancelled.current && title && title !== value) onSave(title);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') cancelled.current = true;
    if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
  }

  return (
    <Input
      autoFocus
      aria-label={label}
      defaultValue={value}
      maxLength={200}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="h-7 px-1.5 font-medium"
    />
  );
}
