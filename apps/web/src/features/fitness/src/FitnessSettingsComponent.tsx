'use client';

import { type FormEvent, type ReactNode, useState } from 'react';
import { SectionCardComponent, StatTileComponent } from '@/features/budget';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { formatGrams, formatKcal, formatKg, parseAmount } from './fitness-format';
import type { Activity, FitnessViewProps, Goal, MacroPreset, Macros, Profile, Sex } from './fitness-types';
import { bmi, bmiBand, targetsFor, targetWarnings } from './targets-math';

const ACTIVITY_LABELS: Record<Activity, string> = {
  sedentary: 'Sedentary (desk job, little exercise)',
  light: 'Light (exercise 1 to 3 days a week)',
  moderate: 'Moderate (exercise 3 to 5 days a week)',
  active: 'Active (exercise 6 to 7 days a week)',
  veryActive: 'Very active (hard training or a physical job)',
};
const GOAL_LABELS: Record<Goal, string> = { lose: 'Lose weight (calorie deficit)', maintain: 'Maintain weight', gain: 'Gain weight (calorie surplus)' };
const PRESET_LABELS: Record<MacroPreset, string> = {
  balanced: 'Balanced (30% protein, 40% carbs, 30% fat)',
  highProtein: 'High protein (40% protein, 30% carbs, 30% fat)',
  lowCarb: 'Low carb (40% protein, 20% carbs, 40% fat)',
};
const METHOD_LABELS: Record<Macros['method'], string> = {
  preset: 'A preset split',
  perKg: 'Protein per kg of body weight',
  manual: 'Type my own targets',
};
const STARTING_MACROS: { [M in Macros['method']]: Extract<Macros, { method: M }> } = {
  preset: { method: 'preset', preset: 'balanced' },
  perKg: { method: 'perKg', proteinMgPerKg: 1800, carbsPct: 60 },
  manual: { method: 'manual', kcal: 2000, proteinMg: 150_000, carbsMg: 200_000, fatMg: 65_000 },
};

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

type NumberFieldProps = { label: string; hint?: string; value: number | null; scale: number; onChange: (value: number | null) => void };

// Shows a stored whole number (grams, millimetres, milligrams) in the unit people type: value / scale.
function NumberField({ label, hint, value, scale, onChange }: NumberFieldProps) {
  const [text, setText] = useState(value === null ? '' : String(value / scale));
  return (
    <Field label={label} hint={hint}>
      <Input
        inputMode="decimal"
        autoComplete="off"
        className="tabular-nums"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          const typed = parseAmount(event.target.value);
          onChange(typed === null ? null : Math.round(typed * scale));
        }}
      />
    </Field>
  );
}

type ChoiceProps<T extends string> = { label: string; value: T | null; labels: Record<T, string>; onChange: (value: T) => void };

function Choice<T extends string>({ label, value, labels, onChange }: ChoiceProps<T>) {
  return (
    <Field label={label}>
      <Select value={value ?? undefined} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(labels) as T[]).map((key) => (
            <SelectItem key={key} value={key}>
              {labels[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function FitnessSettingsComponent({ fitness, today }: FitnessViewProps) {
  const { saveProfile } = useFitnessMutations();
  const [profile, setProfile] = useState<Profile>(fitness.profile);
  const set = (changes: Partial<Profile>) => setProfile((current) => ({ ...current, ...changes }));
  const weightG = fitness.weights.at(-1)?.weightG ?? null;
  const targets = targetsFor(profile, weightG, today);
  const warnings = targetWarnings(profile, weightG, today);
  const { macros } = profile;
  const unsaved = JSON.stringify(profile) !== JSON.stringify(fitness.profile);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    saveProfile.mutate(profile);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTileComponent
          label="Calorie target"
          value={targets ? formatKcal(targets.kcal) : '—'}
          detail={targets ? 'Per day' : 'Add your height and weight to see targets'}
        />
        <StatTileComponent label="Protein" value={targets ? formatGrams(targets.proteinMg) : '—'} detail="Per day" />
        <StatTileComponent label="Carbs" value={targets ? formatGrams(targets.carbsMg) : '—'} detail="Per day" />
        <StatTileComponent label="Fat" value={targets ? formatGrams(targets.fatMg) : '—'} detail="Per day" />
      </div>

      {warnings.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-xl border border-signal/40 bg-card px-4 py-3 text-sm text-signal">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <SectionCardComponent title="About you">
        <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
          <Choice<Sex> label="Sex" value={profile.sex} labels={{ male: 'Male', female: 'Female' }} onChange={(sex) => set({ sex })} />
          <Field label="Date of birth">
            <Input type="date" max={today} value={profile.birthDate ?? ''} onChange={(event) => set({ birthDate: event.target.value || null })} />
          </Field>
          <NumberField label="Height (cm)" value={profile.heightMm} scale={10} onChange={(heightMm) => set({ heightMm })} />
          <Field label="Current weight" hint="Taken from your latest weigh-in on Progress.">
            <p className="flex h-9 items-center text-sm tabular-nums">
              {weightG ? `${formatKg(weightG)}${profile.heightMm ? ` · BMI ${bmi(weightG, profile.heightMm)} (${bmiBand(bmi(weightG, profile.heightMm))})` : ''}` : 'No weigh-in yet'}
            </p>
          </Field>
          <Choice<Activity> label="Activity level" value={profile.activity} labels={ACTIVITY_LABELS} onChange={(activity) => set({ activity })} />
        </div>
      </SectionCardComponent>

      <SectionCardComponent title="Goal">
        <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
          <Choice<Goal> label="Goal" value={profile.goal} labels={GOAL_LABELS} onChange={(goal) => set({ goal })} />
          <NumberField label="Goal weight (kg)" value={profile.goalWeightG} scale={1000} onChange={(goalWeightG) => set({ goalWeightG })} />
          {profile.goal !== 'maintain' && (
            <NumberField
              label="Pace (kg per week)"
              hint="0.25 to 0.5 is a steady pace for most people."
              value={profile.paceGPerWeek}
              scale={1000}
              onChange={(pace) => set({ paceGPerWeek: Math.min(pace ?? 0, 1500) })}
            />
          )}
        </div>
      </SectionCardComponent>

      <SectionCardComponent title="Macro targets">
        <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
          <Choice<Macros['method']> label="Set them by" value={macros.method} labels={METHOD_LABELS} onChange={(method) => set({ macros: STARTING_MACROS[method] })} />
          {macros.method === 'preset' && (
            <Choice<MacroPreset> label="Split" value={macros.preset} labels={PRESET_LABELS} onChange={(preset) => set({ macros: { method: 'preset', preset } })} />
          )}
          {macros.method === 'perKg' && (
            <>
              <NumberField
                label="Protein (g per kg of body weight)"
                value={macros.proteinMgPerKg}
                scale={1000}
                onChange={(value) => set({ macros: { ...macros, proteinMgPerKg: Math.min(Math.max(value ?? 500, 500), 4000) } })}
              />
              <NumberField
                label="Carbs (% of the remaining calories)"
                hint="The rest goes to fat."
                value={macros.carbsPct}
                scale={1}
                onChange={(value) => set({ macros: { ...macros, carbsPct: Math.min(value ?? 0, 100) } })}
              />
            </>
          )}
          {macros.method === 'manual' && (
            <>
              <NumberField label="Calories (kcal)" value={macros.kcal} scale={1} onChange={(value) => set({ macros: { ...macros, kcal: Math.min(Math.max(value ?? 500, 500), 10_000) } })} />
              <NumberField label="Protein (g)" value={macros.proteinMg} scale={1000} onChange={(value) => set({ macros: { ...macros, proteinMg: value ?? 0 } })} />
              <NumberField label="Carbs (g)" value={macros.carbsMg} scale={1000} onChange={(value) => set({ macros: { ...macros, carbsMg: value ?? 0 } })} />
              <NumberField label="Fat (g)" value={macros.fatMg} scale={1000} onChange={(value) => set({ macros: { ...macros, fatMg: value ?? 0 } })} />
            </>
          )}
        </div>
      </SectionCardComponent>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!unsaved}>
          Save settings
        </Button>
        {unsaved && <span className="text-sm text-muted-foreground">You have unsaved changes.</span>}
      </div>
    </form>
  );
}
