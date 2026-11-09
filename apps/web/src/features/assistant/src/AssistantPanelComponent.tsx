'use client';

import { ArrowUp, Sparkles, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { SkeletonBox } from 'skullet/react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/utils/cn';
import { useAssistantChat } from '../hooks/useAssistantChat';
import { SUGGESTED_PROMPTS } from './dummy-assistant';

function AssistantChat({ messages, replying, send }: ReturnType<typeof useAssistantChat>) {
  const [draft, setDraft] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const showSuggestions = messages.every((message) => message.role === 'assistant') && !replying;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, replying]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void send(draft);
    setDraft('');
  }

  return (
    <>
      <div ref={logRef} role="log" aria-label="Conversation" className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 text-sm">
        {messages.map(({ id, role, text }) => (
          <p
            key={id}
            className={cn(
              'whitespace-pre-line',
              role === 'user' ? 'ml-auto max-w-[85%] rounded-2xl bg-secondary px-3 py-2' : 'max-w-[92%]',
            )}
          >
            {text}
          </p>
        ))}
        {replying && (
          <div role="status" aria-label="Assistant is replying" className="flex flex-col gap-1.5">
            <SkeletonBox width="80%" height={14} />
            <SkeletonBox width="55%" height={14} />
          </div>
        )}
        {showSuggestions && (
          <div className="mt-1 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <Button key={prompt} variant="outline" size="sm" onClick={() => void send(prompt)}>
                {prompt}
              </Button>
            ))}
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-3">
        <Input
          autoFocus
          aria-label="Message the assistant"
          placeholder="Ask anything"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" size="icon" aria-label="Send" disabled={replying || !draft.trim()}>
          <ArrowUp aria-hidden />
        </Button>
      </form>
    </>
  );
}

export function AssistantPanelComponent() {
  const chat = useAssistantChat();
  const [open, setOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  function close() {
    flushSync(() => setOpen(false));
    openButtonRef.current?.focus();
  }

  if (!open) {
    return (
      <Button
        ref={openButtonRef}
        variant="secondary"
        size="lg"
        className="fixed right-5 bottom-5 z-40 rounded-full border shadow-lg"
        onClick={() => setOpen(true)}
      >
        <Sparkles aria-hidden />
        Assistant
      </Button>
    );
  }

  return (
    <aside
      aria-label="Assistant"
      className="fixed top-0 right-0 z-50 flex h-dvh w-full flex-col border-l bg-sidebar sm:w-96 lg:sticky lg:z-auto lg:w-80 lg:shrink-0"
    >
      <header className="flex items-start justify-between gap-2 border-b p-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4" aria-hidden />
            Assistant
          </h2>
          <p className="text-sm text-muted-foreground">Sample replies for now. It can&apos;t see your tasks yet.</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close assistant" onClick={close}>
          <X aria-hidden />
        </Button>
      </header>
      <AssistantChat {...chat} />
    </aside>
  );
}
