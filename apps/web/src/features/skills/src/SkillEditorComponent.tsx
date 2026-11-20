'use client';

import { Copy, Download, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { type NotebookPage, type PageChanges, type SaveStatus, usePageAutosave } from '@/features/notebook';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/utils/cn';
import { DESCRIPTION_MAX, downloadSkill, type ImprovedSkill, type SkillDraft, skillContent, skillHints, skillOf, toSkillMd, toSkillName } from './skill-md';
import { SkillImprovePanelComponent } from './SkillImprovePanelComponent';

const formatSize = (text: string) => {
  const bytes = new TextEncoder().encode(text).length;
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
};

// Everything but the name is page content; the name is the page title.
const CONTENT_KEYS = ['description', 'body', 'frontmatter', 'files'] as const;

const STATUS_LABELS: Record<SaveStatus, string> = { saved: 'Saved', saving: 'Saving', failed: 'Not saved', conflict: 'Changed by someone else' };

function Hint({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-xs text-foreground">
      <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      {text}
    </p>
  );
}

export function SkillEditorComponent({ page, spaceId, canEdit }: { page: NotebookPage; spaceId: string; canEdit: boolean }) {
  const { schedule, status, reload } = usePageAutosave(page.id, page.version);
  const [skill, setSkill] = useState<SkillDraft>(() => skillOf(page));
  const [improving, setImproving] = useState(false);
  // The latest skill, for Undo: a toast's callback outlives the render it was made in.
  const latest = useRef(skill);
  const hints = skillHints(skill);

  function change(next: SkillDraft) {
    const previous = latest.current;
    latest.current = next;
    setSkill(next);
    const changes: PageChanges = {};
    if (next.name !== previous.name) changes.title = next.name;
    if (CONTENT_KEYS.some((key) => next[key] !== previous[key])) changes.content = skillContent(next);
    if (Object.keys(changes).length > 0) schedule(changes);
  }

  // A change you can take back from its toast.
  function changeWithUndo(next: SkillDraft, message: string) {
    const before = latest.current;
    change(next);
    toast(message, { action: { label: 'Undo', onClick: () => change(before) } });
  }

  function applyImproved({ name, description, body }: ImprovedSkill) {
    changeWithUndo({ ...latest.current, name, description, body }, 'Using the improved version');
    setImproving(false);
  }

  async function handleReload() {
    const fresh = await reload();
    if (!fresh) return;
    latest.current = skillOf(fresh);
    setSkill(latest.current);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(toSkillMd(skill));
      toast('Copied SKILL.md');
    } catch {
      toast.error("Couldn't copy. Use Download instead.");
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col md:flex-row">
      <article className="mx-auto w-full max-w-3xl min-w-0 px-4 py-6 pb-24 md:px-8 md:py-8">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="min-w-0 flex-1 truncate font-mono text-lg font-semibold">{skill.name || 'untitled-skill'}</h2>
          {canEdit && (
            <span role="status" className={cn('text-[13px] text-muted-foreground', (status === 'failed' || status === 'conflict') && 'text-destructive')}>
              {STATUS_LABELS[status]}
            </span>
          )}
          {canEdit && status === 'conflict' && (
            <Button variant="outline" size="sm" onClick={handleReload}>
              Reload
            </Button>
          )}
          {canEdit && (
            <Button size="sm" disabled={improving || status === 'conflict'} onClick={() => setImproving(true)}>
              <Sparkles aria-hidden />
              Improve with AI
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => downloadSkill(skill)}>
            <Download aria-hidden />
            {skill.files.length > 0 ? 'Download folder (.zip)' : 'Download SKILL.md'}
          </Button>
          <Button variant="ghost" size="icon" className="size-8" aria-label="Copy SKILL.md" title="Copy SKILL.md" onClick={copy}>
            <Copy aria-hidden />
          </Button>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          <div>
            <Label htmlFor="skill-name">Name</Label>
            <Input
              id="skill-name"
              autoFocus={canEdit && !page.title && !page.content}
              readOnly={!canEdit}
              maxLength={64}
              placeholder="deploy-checklist"
              value={skill.name}
              aria-describedby={hints.name ? 'skill-name-hint' : undefined}
              onChange={(event) => change({ ...skill, name: toSkillName(event.target.value) })}
              className="mt-1.5 font-mono"
            />
            <Hint id="skill-name-hint" text={hints.name} />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="skill-description">Description: when Claude should use it</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {skill.description.trim().length}/{DESCRIPTION_MAX}
              </span>
            </div>
            <Textarea
              id="skill-description"
              readOnly={!canEdit}
              rows={2}
              placeholder="Use when shipping a release to production. Runs the migrations, builds both apps and checks the health endpoint."
              value={skill.description}
              aria-describedby={hints.description ? 'skill-description-hint' : undefined}
              onChange={(event) => change({ ...skill, description: event.target.value })}
              className="mt-1.5 resize-y"
            />
            <Hint id="skill-description-hint" text={hints.description} />
          </div>
          <Tabs defaultValue="write">
            <TabsList variant="line">
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="file">SKILL.md</TabsTrigger>
              {skill.files.length > 0 && <TabsTrigger value="files">Files ({skill.files.length})</TabsTrigger>}
            </TabsList>
            <TabsContent value="write">
              <Textarea
                aria-label="Instructions"
                readOnly={!canEdit}
                placeholder={'# What Claude should do\n\n1. First step…'}
                value={skill.body}
                onChange={(event) => change({ ...skill, body: event.target.value })}
                className="mt-2 min-h-[50vh] resize-y font-mono text-[13px] leading-relaxed"
              />
            </TabsContent>
            <TabsContent value="file">
              <pre aria-label="SKILL.md" className="mt-2 min-h-[50vh] overflow-x-auto rounded-md border bg-card p-3 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
                {toSkillMd(skill)}
              </pre>
            </TabsContent>
            <TabsContent value="files">
              <ul aria-label="Files" className="mt-2 divide-y overflow-hidden rounded-md border">
                {skill.files.map((file) => (
                  <li key={file.path}>
                    <details className="group">
                      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 font-mono text-[13px] hover:bg-accent">
                        <span className="min-w-0 flex-1 truncate">{file.path}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{formatSize(file.content)}</span>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            aria-label={`Remove ${file.path}`}
                            onClick={(event) => {
                              event.preventDefault();
                              changeWithUndo({ ...skill, files: skill.files.filter(({ path }) => path !== file.path) }, `Removed ${file.path}`);
                            }}
                          >
                            <X aria-hidden />
                          </Button>
                        )}
                      </summary>
                      <pre className="max-h-96 overflow-auto border-t bg-card p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{file.content}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            </TabsContent>
          </Tabs>
        </div>
      </article>

      {improving && (
        <SkillImprovePanelComponent spaceId={spaceId} skill={skill} onUse={applyImproved} onClose={() => setImproving(false)} />
      )}
    </div>
  );
}
