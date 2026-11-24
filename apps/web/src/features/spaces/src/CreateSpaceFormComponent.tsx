'use client';

import { Activity, BookMarked, BriefcaseBusiness, Dumbbell, List, Network, ScrollText, Timer, Workflow } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, type ReactNode, useState } from 'react';
import { BudgetIcon, NotebookIcon, VaultIcon } from '@/shared/components/BrandIconsComponent';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { cn } from '@/shared/utils/cn';
import { useCreateSpace } from '../hooks/useCreateSpace';
import { spaceHref } from './space-tree';
import { type Space, type SpaceTool, TOOLS } from './space-types';

type CreateSpaceFormProps = {
  kind?: Space['kind'];
  parentFolder?: Space;
  // The sidebar group a top-level folder or space goes into; the first one when not given.
  groupId?: string;
  onDone?: () => void;
  onCancel?: () => void;
};

const TOOL_ICONS: Record<SpaceTool, ReactNode> = {
  list: <List className="size-[18px]" aria-hidden />,
  notebook: <NotebookIcon className="size-[18px]" aria-hidden />,
  book: <BookMarked className="size-[18px]" aria-hidden />,
  vault: <VaultIcon className="size-[18px]" aria-hidden />,
  budget: <BudgetIcon className="size-[18px]" aria-hidden />,
  fitness: <Dumbbell className="size-[18px]" aria-hidden />,
  jobs: <BriefcaseBusiness className="size-[18px]" aria-hidden />,
  diagram: <Network className="size-[18px]" aria-hidden />,
  pipelines: <Workflow className="size-[18px]" aria-hidden />,
  skills: <ScrollText className="size-[18px]" aria-hidden />,
  uptime: <Activity className="size-[18px]" aria-hidden />,
  focus: <Timer className="size-[18px]" aria-hidden />,
};

export function CreateSpaceFormComponent({ kind = 'space', parentFolder, groupId, onDone, onCancel }: CreateSpaceFormProps) {
  const router = useRouter();
  const createSpace = useCreateSpace();
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
          ? { kind, title, ...(groupId ? { groupId } : {}) }
          : { kind, title, tool, ...(parentFolder ? { parentId: parentFolder.id } : groupId ? { groupId } : {}) },
      );
      if (!isFolder) router.push(spaceHref({ id: created.id, tool }));
      onDone?.();
    } catch {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4 text-left">
      {!isFolder && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm leading-none font-medium">Tool</span>
          <div className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto p-0.5 sm:grid-cols-3">
            {TOOLS.map(({ id, label, description }) => (
              <button
                key={id}
                type="button"
                aria-pressed={tool === id}
                onClick={() => setTool(id)}
                className={cn(
                  'flex flex-col items-start gap-2.5 rounded-[20px] border-2 border-muted p-3 text-left transition-colors dark:border-border',
                  tool === id ? 'border-primary dark:border-primary' : 'hover:bg-accent',
                )}
              >
                <span className="grid size-8 place-items-center rounded-[10px] bg-muted">{TOOL_ICONS[id]}</span>
                <span>
                  <b className="block text-sm font-semibold">{label}</b>
                  <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{description}</span>
                </span>
              </button>
            ))}
          </div>
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
