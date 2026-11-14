'use client';

import { ArrowUp, type LucideIcon, Maximize2, Minimize2, Sparkles, SpellCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { SkeletonBox } from 'skullet/react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';

const PRESETS: { label: string; Icon: LucideIcon; instruction: string }[] = [
  { label: 'Improve writing', Icon: Sparkles, instruction: 'Improve the writing: clearer, more vivid and better flowing, at about the same length.' },
  { label: 'Fix spelling and grammar', Icon: SpellCheck, instruction: 'Fix spelling, grammar and punctuation only. Change nothing else.' },
  { label: 'Make shorter', Icon: Minimize2, instruction: 'Make it noticeably shorter without losing the point.' },
  { label: 'Make longer', Icon: Maximize2, instruction: 'Expand it with more detail and description, without adding new events or facts.' },
];

type AiRewriteMenuProps = { isPending: boolean; onRewrite: (instruction: string) => void };

export function AiRewriteMenuComponent({ isPending, onRewrite }: AiRewriteMenuProps) {
  const [instruction, setInstruction] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (instruction.trim()) onRewrite(instruction);
  }

  if (isPending) {
    return (
      <div role="status" aria-label="Rewriting with AI" className="flex flex-col gap-2 p-2">
        <SkeletonBox width="90%" height={14} />
        <SkeletonBox width="75%" height={14} />
        <SkeletonBox width="55%" height={14} />
      </div>
    );
  }

  return (
    <>
      {PRESETS.map(({ label, Icon, instruction: preset }) => (
        <Button key={label} type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={() => onRewrite(preset)}>
          <Icon aria-hidden />
          {label}
        </Button>
      ))}
      <div className="my-1 border-t" />
      <form onSubmit={handleSubmit} className="flex items-center gap-1 p-0.5">
        <Input
          aria-label="Tell the AI what to change"
          placeholder="Or say what to change"
          maxLength={300}
          className="h-9"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
        />
        <Button type="submit" variant="ghost" size="icon" aria-label="Rewrite with this instruction" className="size-9 shrink-0" disabled={!instruction.trim()}>
          <ArrowUp aria-hidden />
        </Button>
      </form>
    </>
  );
}
