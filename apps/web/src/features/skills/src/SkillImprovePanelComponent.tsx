'use client';

import { useMutation } from '@tanstack/react-query';
import { Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { diffLines } from '@/features/notebook';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/utils/cn';
import { type ImprovedSkill, type SkillDraft, toSkillMd } from './skill-md';
import { improveSkill } from './skills-api';

const QUICK_ASKS = ['Shorter', 'More specific triggers', 'Add examples', 'Add a checklist'];
const MARKS = { same: ' ', added: '+', removed: '−' };

const SAMPLE_ROUND: ImprovedSkill = {
  name: 'sample-skill',
  description: 'Use when shipping a release to production, before telling the team.',
  body: '# Sample\n\n1. First step.\n2. Second step.',
  purpose: 'Walks Claude through a release, step by step, and stops if a check fails.',
  changes: ['Description says when to use it', 'Steps are numbered'],
};

type SkillImprovePanelProps = {
  spaceId: string;
  // The skill as it is in the editor: the first round improves it, and every round is compared with it.
  skill: SkillDraft;
  onUse: (skill: ImprovedSkill) => void;
  onClose: () => void;
};

export function SkillImprovePanelComponent({ spaceId, skill, onUse, onClose }: SkillImprovePanelProps) {
  const [rounds, setRounds] = useState<ImprovedSkill[]>([]);
  const [shown, setShown] = useState(0);
  const [instruction, setInstruction] = useState('');
  const improve = useMutation({
    mutationFn: improveSkill,
    onSuccess: (next) => {
      setRounds([...rounds, next]);
      setShown(rounds.length);
      setInstruction('');
    },
  });
  const round = rounds[shown];
  const started = useRef(false);

  // Each round builds on the one on screen, so "improve more" never loses a round you went back to.
  // One request at a time, so a new round always lands after the ones before it.
  function run(ask?: string) {
    if (improve.isPending) return;
    const { name, description, body } = round ?? skill;
    const files = skill.files.map(({ path }) => path);
    improve.mutate({ spaceId, skill: { name, description, body, ...(files.length > 0 ? { files } : {}) }, instruction: ask?.trim() || undefined });
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run();
  });

  const display = round ?? SAMPLE_ROUND;
  const diff = diffLines(toSkillMd(skill).split('\n'), toSkillMd({ ...skill, ...display }).split('\n'));

  return (
    <aside aria-label="Improve skill" className="flex min-h-0 flex-col border-t bg-sidebar md:sticky md:top-0 md:h-[calc(100dvh-1rem)] md:w-[420px] md:shrink-0 md:border-t-0 md:border-l">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="size-4" aria-hidden />
        <h2 className="text-sm font-semibold">Improve skill</h2>
        {rounds.length > 0 && <span className="ml-auto text-xs text-muted-foreground">Round {shown + 1}</span>}
        <Button variant="ghost" size="icon" className={cn('size-7', rounds.length === 0 && 'ml-auto')} aria-label="Close" onClick={onClose}>
          <X aria-hidden />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {improve.isError && !improve.isPending && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive">
            {improve.error.message}
            <Button variant="outline" size="sm" onClick={() => run(improve.variables?.instruction)}>
              Try again
            </Button>
          </div>
        )}

        {(round || improve.isPending) && (
          <Skeleton loading={improve.isPending} label="Improving skill">
            <section className="rounded-xl border bg-card p-3">
              <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">What this skill is for</h3>
              <p className="text-sm">{display.purpose}</p>
            </section>
            {display.changes.length > 0 && (
              <section className="mt-4 rounded-xl border bg-card p-3">
                <h3 className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">What changed</h3>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {display.changes.map((change) => (
                    <li key={change}>{change}</li>
                  ))}
                </ul>
              </section>
            )}
            <section aria-label="Compared with yours" className="mt-4 overflow-hidden rounded-xl border font-mono text-xs leading-relaxed">
              {diff.map((line, index) => (
                <div
                  key={index}
                  data-kind={line.kind}
                  className={cn(
                    'px-3 break-words whitespace-pre-wrap',
                    line.kind === 'same' && 'text-muted-foreground',
                    line.kind === 'added' && 'bg-accent',
                    line.kind === 'removed' && 'text-destructive line-through decoration-destructive/50',
                  )}
                >
                  <span aria-hidden className="mr-2 inline-block w-2 text-muted-foreground">{MARKS[line.kind]}</span>
                  <span className="sr-only">{line.kind === 'added' ? 'Added: ' : line.kind === 'removed' ? 'Removed: ' : ''}</span>
                  {line.text || ' '}
                </div>
              ))}
            </section>
          </Skeleton>
        )}

        {rounds.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Rounds
            {rounds.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-pressed={index === shown}
                aria-label={`Round ${index + 1}`}
                onClick={() => setShown(index)}
                className="rounded-full border px-2.5 py-0.5 hover:bg-accent aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background"
              >
                {index + 1}
              </button>
            ))}
          </div>
        )}

        {round && (
          <div className="flex flex-col gap-2">
            <label htmlFor="improve-more" className="text-sm font-medium">
              Improve more
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ASKS.map((ask) => (
                <button
                  key={ask}
                  type="button"
                  disabled={improve.isPending}
                  onClick={() => run(ask)}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                >
                  {ask}
                </button>
              ))}
            </div>
            <Textarea
              id="improve-more"
              maxLength={300}
              rows={2}
              placeholder="Tell it what to change next, e.g. “also roll back if the health check fails”"
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && instruction.trim()) {
                  event.preventDefault();
                  run(instruction);
                }
              }}
              className="resize-none"
            />
          </div>
        )}
      </div>

      <footer className="flex items-center gap-2 border-t px-4 py-3">
        <Button variant="ghost" onClick={onClose}>
          Discard
        </Button>
        <span className="flex-1" />
        <Button variant="outline" disabled={!round || improve.isPending} onClick={() => run(instruction)}>
          <Sparkles aria-hidden />
          Improve more
        </Button>
        <Button disabled={!round || improve.isPending} onClick={() => round && onUse(round)}>
          Use this version
        </Button>
      </footer>
    </aside>
  );
}
