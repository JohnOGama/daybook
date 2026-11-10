'use client';

import { BookOpen, Folder, Hash, List, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/utils/cn';
import { useCreateSpace } from '../hooks/useCreateSpace';
import { spaceHref } from './space-tree';
import { type Space, type SpaceTool, TOOLS } from './space-types';

type CreateSpaceFormProps = {
  allowFolder?: boolean;
  parentFolder?: Space;
  onDone?: () => void;
  onCancel?: () => void;
};

const TOOL_ICONS: Record<SpaceTool, ReactNode> = {
  list: <List className="size-[18px]" aria-hidden />,
  notebook: <BookOpen className="size-[18px]" aria-hidden />,
  vault: <Lock className="size-[18px]" aria-hidden />,
};

export function CreateSpaceFormComponent({ allowFolder, parentFolder, onDone, onCancel }: CreateSpaceFormProps) {
  const router = useRouter();
  const createSpace = useCreateSpace();
  const [kind, setKind] = useState<Space['kind']>('space');
  const [title, setTitle] = useState('');
  const [tool, setTool] = useState<SpaceTool>('list');
  const [saving, setSaving] = useState(false);
  const isFolder = kind === 'folder';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const created = await createSpace.mutateAsync(
        isFolder
          ? { kind, title }
          : { kind, title, tool, ...(parentFolder ? { parentId: parentFolder.id } : {}) },
      );
      if (!isFolder) router.push(spaceHref({ id: created.id, tool }));
      onDone?.();
    } catch {
      setSaving(false);
    }
  }

  const kindOptions = [
    { value: 'space' as const, label: 'Space', icon: <Hash aria-hidden /> },
    { value: 'folder' as const, label: 'Folder', icon: <Folder aria-hidden /> },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4 text-left">
      {allowFolder && (
        <div className="flex gap-1 rounded-lg border bg-sidebar p-0.5">
          {kindOptions.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => setKind(value)}
              className={cn(
                'flex h-8 flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium text-muted-foreground transition-colors [&_svg]:size-4',
                kind === value && 'bg-background text-foreground shadow-xs',
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="space-title">Title</Label>
        <Input
          id="space-title"
          autoFocus
          maxLength={200}
          placeholder={isFolder ? 'e.g. Design Team' : 'e.g. Personal'}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      {!isFolder && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm leading-none font-medium">Tool</span>
          {TOOLS.map(({ id, label, description }) => (
            <button
              key={id}
              type="button"
              aria-pressed={tool === id}
              onClick={() => setTool(id)}
              className={cn(
                'flex items-center gap-3 rounded-xl border-[1.5px] p-2.5 text-left',
                tool === id ? 'border-primary bg-primary/10' : 'hover:bg-accent',
              )}
            >
              <span className="grid size-8 place-items-center rounded-lg border bg-background">
                {TOOL_ICONS[id]}
              </span>
              <span>
                <b className="block text-sm font-semibold">{label}</b>
                <span className="text-xs text-muted-foreground">{description}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className={cn('flex gap-2', onCancel && 'justify-end')}>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving || title.trim().length === 0} className={cn(!onCancel && 'w-full')}>
          Create
        </Button>
      </div>
    </form>
  );
}
