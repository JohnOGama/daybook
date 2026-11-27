'use client';

import { type ReactNode, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { toast } from 'sonner';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { cn } from '@/shared/utils/cn';
import { useFitnessSpaceId } from '../hooks/useFitness';
import { useFitnessMutations } from '../hooks/useFitnessMutations';
import { type MacroSuggestion, suggestMacros } from './fitness-api';
import { formatGrams, formatKcal, formatKg, parseAmount } from './fitness-format';
import type { Activity, Fitness, Goal, Macros, Profile, Sex } from './fitness-types';
import { forecast, planGPerDay } from './forecast-math';
import { ageOn, bmi, bmiBand, energyFor, goalKcalPerDay, targetsFor, targetWarnings } from './targets-math';

const STEPS = 4;
const STANDARD: Macros = { method: 'preset', preset: 'balanced' };

const ACTIVITIES: { value: Activity; label: string; detail: string }[] = [
  { value: 'sedentary', label: 'Desk', detail: 'Little or no exercise.' },
  { value: 'light', label: 'Light', detail: 'Exercise 1–3 days a week.' },
  { value: 'moderate', label: 'Moderate', detail: 'Exercise 3–5 days a week.' },
  { value: 'active', label: 'Active', detail: 'Hard exercise 6–7 days a week.' },
  { value: 'veryActive', label: 'Very', detail: 'Hard daily training or a physical job.' },
];

const GOALS: { value: Goal; label: string }[] = [
  { value: 'lose', label: 'Lose' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain', label: 'Gain' },
];

const PACES: Record<Exclude<Goal, 'maintain'>, { grams: number; note: string }[]> = {
  lose: [
    { grams: 250, note: 'gentle' },
    { grams: 500, note: 'steady' },
    { grams: 750, note: 'faster' },
    { grams: 1000, note: 'hard' },
  ],
  gain: [
    { grams: 250, note: 'lean' },
    { grams: 500, note: 'faster' },
  ],
};

const formatDate = (day: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T00:00:00Z`));
const gramsFrom = (kgText: string) => {
  const kg = parseAmount(kgText);
  return kg === null ? null : Math.round(kg * 1000);
};
const inRange = (grams: number | null, min: number, max: number): grams is number => grams !== null && grams >= min && grams <= max;

function Heading({ step, kicker, title, detail }: { step: number; kicker: string; title: string; detail: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">
        Step {step} of {STEPS} · {kicker}
      </p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function Tile({ label, value, detail, children }: { label: string; value: string; detail?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-muted px-3 py-2.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tracking-tight tabular-nums">{value}</span>
      {detail && <span className="text-xs text-muted-foreground tabular-nums">{detail}</span>}
      {children}
    </div>
  );
}

// A strip from BMI 15 to 35 with the healthy band (18.5–25) marked and a tick at the person's own BMI.
function BmiScale({ value }: { value: number }) {
  const at = (bmiValue: number) => `${Math.min(Math.max((bmiValue - 15) / 20, 0), 1) * 100}%`;
  return (
    <div aria-hidden className="mt-2">
      <div className="relative h-1.5 rounded-full bg-foreground/15">
        <span className="absolute inset-y-0 rounded-full bg-signal" style={{ left: at(18.5), width: `calc(${at(25)} - ${at(18.5)})` }} />
        <span className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: at(value) }} />
      </div>
      <div className="relative mt-1 h-3 text-[10px] text-muted-foreground tabular-nums">
        {[18.5, 25, 30].map((mark) => (
          <span key={mark} className="absolute -translate-x-1/2" style={{ left: at(mark) }}>
            {mark}
          </span>
        ))}
      </div>
    </div>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T | null; options: { value: T; label: string }[]; onChange: (next: T) => void }) {
  return (
    <ToggleGroup type="single" variant="outline" aria-label={label} value={value ?? ''} onValueChange={(next) => next && onChange(next as T)} className="w-full">
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value} className="flex-1">
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

type FitnessSetupProps = { fitness: Fitness; today: string; onLeave: () => void };

// The four-step onboarding: about you, weight, pace, and the daily targets with AI-suggested macros. It writes the same
// profile Settings edits, plus today's weight as a weigh-in. Nothing is saved until "Save and start".
export function FitnessSetupComponent({ fitness, today, onLeave }: FitnessSetupProps) {
  const spaceId = useFitnessSpaceId() as string;
  const { saveProfile, saveWeight } = useFitnessMutations();
  const start = fitness.profile;
  const latest = fitness.weights.filter((weight) => weight.day <= today).at(-1) ?? null;

  const [step, setStep] = useState(1);
  const [sex, setSex] = useState<Sex | null>(start.sex);
  const [birthDate, setBirthDate] = useState(start.birthDate ?? '');
  const [heightCm, setHeightCm] = useState(start.heightMm ? String(start.heightMm / 10) : '');
  const [activity, setActivity] = useState<Activity>(start.activity);
  const [weightKg, setWeightKg] = useState(latest ? String(latest.weightG / 1000) : '');
  const [goalKg, setGoalKg] = useState(start.goalWeightG ? String(start.goalWeightG / 1000) : '');
  const [goal, setGoal] = useState<Goal>(start.goal);
  const [pace, setPace] = useState(start.paceGPerWeek);
  const [suggestion, setSuggestion] = useState<MacroSuggestion | null>(null);
  const [asking, setAsking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [useStandard, setUseStandard] = useState(!fitness.aiEnabled);

  const cm = parseAmount(heightCm);
  const heightMm = cm === null ? null : Math.round(cm * 10);
  const weightG = gramsFrom(weightKg);
  const goalWeightG = goalKg.trim() === '' ? null : gramsFrom(goalKg);
  const age = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && birthDate <= today ? ageOn(birthDate, today) : null;

  const aboutDone = sex !== null && age !== null && age >= 13 && age <= 120 && inRange(heightMm, 500, 2500);
  const weightDone = inRange(weightG, 20_000, 400_000) && (goalKg.trim() === '' || inRange(goalWeightG, 20_000, 400_000));

  const macros: Macros = suggestion && !useStandard ? { method: 'perKg', proteinMgPerKg: Math.round(suggestion.proteinGPerKg * 1000), carbsPct: suggestion.carbsPct } : STANDARD;
  const draft: Profile = { ...start, sex, birthDate: birthDate || null, heightMm, activity, goal, goalWeightG, paceGPerWeek: pace, macros };
  const energy = aboutDone && weightDone ? energyFor(draft, weightG, today) : null;
  const targets = energy ? targetsFor(draft, weightG, today) : null;
  const warnings = energy ? targetWarnings(draft, weightG, today) : [];
  const bmiValue = weightG !== null && heightMm ? bmi(weightG, heightMm) : null;
  const goalShift = goalKcalPerDay(draft);
  const reachedOn = weightG !== null && goalWeightG !== null && goal !== 'maintain' ? forecast({ startG: weightG, goalG: goalWeightG, today, horizonDays: 730, gPerDay: planGPerDay(draft) }).reachedOn : null;

  function chooseGoal(next: Goal) {
    setGoal(next);
    if (next === 'gain') setPace(250);
    if (next === 'lose' && !PACES.lose.some(({ grams }) => grams === pace)) setPace(500);
  }

  async function askAi() {
    if (!fitness.aiEnabled || !energy || age === null || !sex || weightG === null || heightMm === null) return;
    setAsking(true);
    setAiError(null);
    try {
      const result = await suggestMacros({
        spaceId,
        figures: {
          age,
          sex,
          heightCm: heightMm / 10,
          weightKg: weightG / 1000,
          goalWeightKg: goalWeightG === null ? null : goalWeightG / 1000,
          goal,
          paceKgPerWeek: goal === 'maintain' ? 0 : pace / 1000,
          activity,
          dailyKcal: Math.max(500, energy.daily + goalShift),
        },
      });
      setSuggestion(result);
      setUseStandard(false);
    } catch (failure) {
      setAiError(failure instanceof Error ? failure.message : "The AI couldn't suggest macros just now.");
      setUseStandard(true);
    } finally {
      setAsking(false);
    }
  }

  function next() {
    if (step === 2 && weightG !== null && goalWeightG !== null) chooseGoal(goalWeightG < weightG ? 'lose' : goalWeightG > weightG ? 'gain' : 'maintain');
    // The figures may have changed since a past visit to the last step, so the AI is asked afresh each time.
    if (step === 3) void askAi();
    setStep(step + 1);
  }

  function save() {
    if (!targets || weightG === null) return;
    saveProfile.mutate(draft);
    if (latest?.day !== today || latest.weightG !== weightG) saveWeight.mutate({ day: today, weightG });
    toast.success('Your plan is set. Change it any time in Settings.');
    onLeave();
  }

  const canContinue = step === 1 ? aboutDone : step === 2 ? weightDone : true;
  const activityDetail = ACTIVITIES.find(({ value }) => value === activity)?.detail;

  return (
    <div className="w-full max-w-xl">
      <section aria-label="Set up your fitness plan" className="flex flex-col gap-5 rounded-xl bg-card p-5 sm:p-6">
        <div aria-hidden className="flex gap-1.5">
          {Array.from({ length: STEPS }, (_, index) => (
            <span key={index} className={cn('h-1 flex-1 rounded-full bg-muted transition-colors', index < step && 'bg-foreground')} />
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Heading step={1} kicker="About you" title="Let’s set up your fitness space" detail="These set your daily calories. They stay in this space, and you can change them later in Settings." />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Sex (for the calorie formula)</span>
              <Choice
                label="Sex"
                value={sex}
                options={[
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                ]}
                onChange={setSex}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="setup-birth">Birth date</Label>
                <Input id="setup-birth" type="date" max={today} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="setup-height">Height (cm)</Label>
                <Input id="setup-height" inputMode="decimal" autoComplete="off" placeholder="180" className="tabular-nums" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">How active are you?</span>
              <Choice label="Activity" value={activity} options={ACTIVITIES} onChange={setActivity} />
              {activityDetail && <span className="text-xs text-muted-foreground">{activityDetail}</span>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Heading step={2} kicker="Your weight" title="Where you are, and where you’re going" detail="Today’s weight is saved as your first weigh-in." />
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="setup-weight">Weight today (kg)</Label>
                <Input id="setup-weight" inputMode="decimal" autoComplete="off" placeholder="80.0" className="tabular-nums" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="setup-goal-weight">Goal weight (kg, optional)</Label>
                <Input id="setup-goal-weight" inputMode="decimal" autoComplete="off" placeholder="75.0" className="tabular-nums" value={goalKg} onChange={(event) => setGoalKg(event.target.value)} />
              </div>
            </div>
            {bmiValue !== null && weightDone && (
              <Tile label="Your BMI" value={`${bmiValue} · ${bmiBand(bmiValue)}`}>
                <BmiScale value={bmiValue} />
              </Tile>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <Heading
              step={3}
              kicker="Your pace"
              title="How fast do you want to change?"
              detail={
                weightG !== null && goalWeightG !== null && goalWeightG !== weightG
                  ? `You’re ${formatKg(Math.abs(weightG - goalWeightG))} ${weightG > goalWeightG ? 'above' : 'below'} your goal.`
                  : 'Pick whether to lose, keep or gain weight.'
              }
            />
            <Choice label="Goal" value={goal} options={GOALS} onChange={chooseGoal} />
            {goal === 'maintain' ? (
              <p className="text-sm text-muted-foreground">Your calories will match what you burn each day.</p>
            ) : (
              <ToggleGroup type="single" variant="outline" aria-label="Pace" value={String(pace)} onValueChange={(chosen) => chosen && setPace(Number(chosen))} className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                {PACES[goal].map(({ grams, note }) => (
                  <ToggleGroupItem key={grams} value={String(grams)} aria-label={`${goal === 'lose' ? 'Lose' : 'Gain'} ${grams / 1000} kg a week`} className="h-auto flex-col items-start gap-0 rounded-xl! border! px-3 py-2">
                    <span className="text-base font-semibold tabular-nums">
                      {goal === 'lose' ? '−' : '+'}
                      {grams / 1000}
                    </span>
                    <span className="text-[11px] font-normal text-muted-foreground">kg / week · {note}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
            {goal !== 'maintain' && energy && (
              <Tile
                label="At this pace"
                value={goalWeightG === null ? 'No goal weight set' : reachedOn ? `${formatKg(goalWeightG)} around ${formatDate(reachedOn)}` : 'Your goal is the other way'}
                detail={`${formatKcal(Math.abs(goalShift))} a day ${goalShift < 0 ? 'below' : 'above'} what you burn`}
              />
            )}
            {warnings.map((warning) => (
              <p key={warning} className="text-xs text-signal">
                {warning}
              </p>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <Heading step={4} kicker="Your plan" title="Your daily targets" detail="You can change any of this later in Settings." />
            {targets && energy ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Tile
                    label="Daily calories"
                    value={formatKcal(targets.kcal)}
                    detail={goalShift === 0 ? 'What you burn each day' : `${formatKcal(energy.daily)} to maintain ${goalShift < 0 ? '−' : '+'} ${Math.abs(goalShift)}`}
                  />
                  {bmiValue !== null && <Tile label="BMI" value={String(bmiValue)} detail={bmiBand(bmiValue)} />}
                </div>
                <div className="flex flex-col gap-3 rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Macros</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', suggestion && !useStandard ? 'bg-signal/20' : 'bg-muted text-muted-foreground')}>
                      {suggestion && !useStandard ? 'AI suggested' : 'Standard split'}
                    </span>
                    {fitness.aiEnabled && (
                      <Button variant="ghost" size="sm" className="ml-auto h-7 text-muted-foreground" disabled={asking} onClick={() => void askAi()}>
                        Suggest again
                      </Button>
                    )}
                  </div>
                  <Skeleton loading={asking} label="Asking the AI for your macros">
                    <div className="grid grid-cols-3 gap-2">
                      <Tile label="Protein" value={formatGrams(targets.proteinMg)} detail={suggestion && !useStandard ? `${suggestion.proteinGPerKg} g per kg` : '30% of calories'} />
                      <Tile label="Carbs" value={formatGrams(targets.carbsMg)} detail={suggestion && !useStandard ? `${suggestion.carbsPct}% of the rest` : '40% of calories'} />
                      <Tile label="Fat" value={formatGrams(targets.fatMg)} detail={suggestion && !useStandard ? 'The rest' : '30% of calories'} />
                    </div>
                    {suggestion && !useStandard && <p className="mt-3 text-sm text-muted-foreground">“{suggestion.reason}”</p>}
                  </Skeleton>
                  {aiError && <p className="text-xs text-destructive">{aiError}</p>}
                  <p className="text-xs text-muted-foreground">
                    {fitness.aiEnabled
                      ? 'AI estimate from your figures only (age, sex, height, weight, goal, pace, activity). Not medical advice. '
                      : 'AI-suggested macros are off on this server, so the standard split is used. '}
                    {suggestion && (
                      <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => setUseStandard(!useStandard)}>
                        {useStandard ? 'Use the AI suggestion' : 'Use the standard split instead'}
                      </button>
                    )}
                  </p>
                </div>
                {warnings.map((warning) => (
                  <p key={warning} className="text-xs text-signal">
                    {warning}
                  </p>
                ))}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Go back and fill in your details to see your targets.</p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button variant="ghost" className="ml-auto text-muted-foreground" onClick={onLeave}>
            Skip for now
          </Button>
          {step < STEPS ? (
            <Button disabled={!canContinue} onClick={next}>
              Continue
            </Button>
          ) : (
            <Button disabled={!targets || asking} onClick={save}>
              Save and start
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}
