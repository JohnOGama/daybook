'use client';

import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

type CurrencySelectProps = { id?: string; value: string; onChange: (currency: string) => void; label?: string };

export function CurrencySelectComponent({ id, value, onChange, label = 'Currency' }: CurrencySelectProps) {
  const options = useMemo(() => {
    const names = new Intl.DisplayNames(['en'], { type: 'currency' });
    return Intl.supportedValuesOf('currency').map((code) => ({ code, name: names.of(code) ?? code }));
  }, []);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} aria-label={id ? undefined : label} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map(({ code, name }) => (
          <SelectItem key={code} value={code}>
            <span className="w-10 font-medium">{code}</span>
            <span className="text-muted-foreground">{name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
