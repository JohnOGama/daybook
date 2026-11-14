'use client';

import { type ReactNode, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import type { ForecastSettings } from './fitness-types';

const LIMITS = { horizonDays: [7, 365], kcalPerKg: [5000, 9000], trendDays: [7, 60] } as const;

function Field({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      <span className="text-xs text-muted-foreground">{hint}</span>
    </label>
  );
}

type ForecastSettingsProps = { settings: ForecastSettings; canMeasure: boolean; onSave: (settings: ForecastSettings) => void };

export function ForecastSettingsComponent({ settings, canMeasure, onSave }: ForecastSettingsProps) {
  const [text, setText] = useState({ horizonDays: String(settings.horizonDays), kcalPerKg: String(settings.kcalPerKg), trendDays: String(settings.trendDays) });
  const [energy, setEnergy] = useState(settings.energy);
  const read = (key: keyof typeof LIMITS) => {
    const value = Number(text[key]);
    return Number.isInteger(value) && value >= LIMITS[key][0] && value <= LIMITS[key][1] ? value : null;
  };
  const next = { horizonDays: read('horizonDays'), kcalPerKg: read('kcalPerKg'), trendDays: read('trendDays') };
  const valid = next.horizonDays !== null && next.kcalPerKg !== null && next.trendDays !== null;
  const number = (key: keyof typeof LIMITS) => (
    <Input inputMode="numeric" className="tabular-nums" aria-invalid={next[key] === null} value={text[key]} onChange={(event) => setText((current) => ({ ...current, [key]: event.target.value }))} />
  );

  return (
    <details className="rounded-xl border bg-card px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold">Advanced forecast settings</summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Look ahead (days)" hint="7 to 365.">
          {number('horizonDays')}
        </Field>
        <Field label="Trend looks back (days)" hint="7 to 60. Shorter reacts faster, longer is steadier.">
          {number('trendDays')}
        </Field>
        <Field label="Calories per kg of body weight" hint="5,000 to 9,000. 7,700 is the usual figure.">
          {number('kcalPerKg')}
        </Field>
        <Field
          label="Daily energy comes from"
          hint={canMeasure ? 'Measured uses what you ate and how your weight moved.' : 'Measured needs three weeks of food and weight logs.'}
        >
          <Select value={canMeasure ? energy : 'formula'} onValueChange={(value) => setEnergy(value as ForecastSettings['energy'])}>
            <SelectTrigger aria-label="Daily energy comes from" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="formula">The formula (height, weight, age, activity)</SelectItem>
              <SelectItem value="measured" disabled={!canMeasure}>
                Measured from my logs
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Button
        className="mt-4"
        size="sm"
        disabled={!valid}
        onClick={() => valid && onSave({ horizonDays: next.horizonDays as number, kcalPerKg: next.kcalPerKg as number, trendDays: next.trendDays as number, energy })}
      >
        Save forecast settings
      </Button>
    </details>
  );
}
