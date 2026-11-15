'use client';

import { ArrowUp } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { ThinkingDotsComponent } from './ThinkingDotsComponent';

const SUGGESTIONS = ["What's on today?", "How's my budget this month?", 'Did the deploy pass?'];
// There is no AI behind the page yet: a question just shows the thinking dots for this long.
const THINKING_MS = 2500;

export function greeting(hour: number): string {
  const part = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return `Good ${part}. What can I help with?`;
}

// The assistant's own page, looks only for now: the dots, a greeting, suggestions and an input.
export function AssistantPageComponent() {
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [hello] = useState(() => greeting(new Date().getHours()));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function think() {
    clearTimeout(timer.current);
    setThinking(true);
    timer.current = setTimeout(() => setThinking(false), THINKING_MS);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setDraft('');
    think();
  }

  return (
    <div className="flex min-h-full flex-col items-center px-4 pt-8 pb-10 md:px-6">
      <section aria-label="Assistant" className="flex w-full flex-1 flex-col items-center justify-center gap-10 py-10">
        <ThinkingDotsComponent thinking={thinking} />
        <div className="flex flex-col items-center gap-2.5 text-center">
          <p aria-hidden className="text-[13px] text-muted-foreground">
            {thinking ? 'Thinking…' : 'Ready when you are'}
          </p>
          <h1 className="text-2xl font-medium tracking-tight md:text-3xl">{hello}</h1>
        </div>
      </section>

      <div className="flex w-full max-w-2xl flex-col gap-3.5">
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((suggestion) => (
            <Button key={suggestion} type="button" variant="outline" size="sm" className="rounded-full font-normal text-foreground/90" onClick={think}>
              {suggestion}
            </Button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-full border bg-popover py-1.5 pr-1.5 pl-5 focus-within:border-foreground/30">
          <Input
            aria-label="Ask the assistant"
            placeholder="Ask anything"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Button type="submit" size="icon" aria-label="Send" className="size-10 shrink-0 rounded-full">
            <ArrowUp aria-hidden />
          </Button>
        </form>
      </div>
    </div>
  );
}
