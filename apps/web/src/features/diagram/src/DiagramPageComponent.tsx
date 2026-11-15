'use client';

import { ArrowUp, FileUp, PanelLeftClose, Sparkles } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { toast } from 'sonner';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { PresenceAvatarsComponent, type SpacePresence, useActiveSpace, useSpaceAccess, useSpacePresence, ViewOnlyBadgeComponent } from '@/features/spaces';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/utils/cn';
import { useDiagram, useDiagramSpaceId } from '../hooks/useDiagram';
import { type LiveChange, useLiveDiagram, writePositions } from '../hooks/useLiveDiagram';
import type { LineRange } from './DbmlEditorComponent';
import type { CanvasHandle } from './DiagramCanvasComponent';
import { exportSql, parseDiagram, sameModel } from './dbml-model';
import { parseInBackground } from './dbml-parse-client';
import { type Diagram, editWithAi } from './diagram-api';
import { placeTables, tidyLayout } from './diagram-layout';
import { DbmlEditor, DiagramCanvas } from './diagram-parts';
import { EMPTY_MODEL, type DiagramModel, type Point, type Positions, type Problem } from './diagram-types';
import { downloadDataUrl, downloadText } from './download';
import { type ExportKind, ExportMenuComponent } from './ExportMenuComponent';
import { fileName } from './file-name';
import { ImportDialogComponent } from './ImportDialogComponent';
import { toMermaid } from './mermaid-export';
import { SAMPLE_DBML } from './sample-diagram';

const PARSE_PAUSE_MS = 300;
const EXAMPLES = [
  'An online shop with users, products, orders and reviews',
  'A blog with authors, posts, comments and tags',
  'A school with students, teachers, classes and grades',
];

type Snapshot = { dbml: string; positions: Positions };
type Fresh = { tables: Set<string>; lines: LineRange[] };
type Parsed = ReturnType<typeof parseDiagram>;
const NO_FRESH: Fresh = { tables: new Set(), lines: [] };
const NO_PROBLEMS: Problem[] = [];

const wideScreen = () => (typeof window === 'undefined' || !window.matchMedia ? true : window.matchMedia('(min-width: 768px)').matches);

// The lines each named table is defined on, so the editor can tint what the AI just added.
function tableLines(text: string, names: Set<string>): LineRange[] {
  const lines = text.split('\n');
  const ranges: LineRange[] = [];
  lines.forEach((line, index) => {
    const name = /^\s*Table\s+"?([\w.]+)"?/.exec(line)?.[1];
    if (!name || !names.has(name)) return;
    let depth = 0;
    for (let end = index; end < lines.length; end++) {
      depth += (lines[end].match(/\{/g)?.length ?? 0) - (lines[end].match(/\}/g)?.length ?? 0);
      if (depth <= 0 && lines[end].includes('}')) {
        ranges.push({ from: index + 1, to: end + 1 });
        return;
      }
    }
  });
  return ranges;
}

// A local document for the sample drawn behind the loading skeleton; nothing is sent anywhere.
function samplePresence(): SpacePresence {
  const doc = new Y.Doc();
  doc.getText('dbml').insert(0, SAMPLE_DBML);
  return { doc, awareness: new Awareness(doc), members: [], connected: true, synced: true, denied: false };
}

function Workspace({ diagram, presence, title }: { diagram: Diagram; presence: SpacePresence; title: string }) {
  const spaceId = useDiagramSpaceId() as string;
  const { canEdit } = useSpaceAccess();
  const { text, positions: stored, ytext, ymap, setPositions, move, change } = useLiveDiagram(presence);
  const canvas = useRef<CanvasHandle>(null);

  // Read once; afterwards the model follows the shared text as it changes, from anyone.
  const [first] = useState(() => parseDiagram(text));
  const [model, setModel] = useState<DiagramModel>(first.ok ? first.model : EMPTY_MODEL);
  const [problems, setProblems] = useState<Problem[]>(first.ok ? [] : first.problems);
  const parsedText = useRef(text);
  // Tables nobody has placed yet are laid out here, so everyone sees them somewhere straight away.
  const positions = useMemo(() => placeTables(model, stored), [model, stored]);
  const [fresh, setFresh] = useState<Fresh>(NO_FRESH);
  const [selected, setSelected] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(wideScreen);
  const [prompt, setPrompt] = useState('');
  const [thinking, setThinking] = useState(false);
  const [importing, setImporting] = useState(false);
  const latest = useRef<Snapshot>({ dbml: text, positions });
  latest.current = { dbml: text, positions };
  const modelNow = useRef(model);
  modelNow.current = model;

  // An editor stores where new tables were placed; a viewer only ever reads.
  useEffect(() => {
    if (canEdit && first.ok) setPositions(placeTables(first.model, ymap.toJSON() as Positions));
  }, [canEdit, first, setPositions, ymap]);

  // Reads the text after any change (typing here or someone else's edit); a broken text keeps the last diagram that worked.
  useEffect(() => {
    if (text === parsedText.current) return;
    let current = true;
    const timer = setTimeout(async () => {
      const parsed = await parseInBackground(text);
      // A newer edit started its own parse; this answer is out of date.
      if (!current) return;
      parsedText.current = text;
      setFresh(NO_FRESH);
      if (!parsed.ok) {
        setProblems(parsed.problems);
        return;
      }
      // Same tables as before (a comment, a blank line): keep the old model so the canvas has nothing to redraw.
      setModel((current) => (sameModel(current, parsed.model) ? current : parsed.model));
      setProblems(NO_PROBLEMS);
      if (canEdit) setPositions(placeTables(parsed.model, ymap.toJSON() as Positions));
    }, PARSE_PAUSE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [text, canEdit, setPositions, ymap]);

  // Shows a text straight away instead of waiting for the background parse.
  function adopt(dbml: string, parsed: Parsed = parseDiagram(dbml)) {
    parsedText.current = dbml;
    setModel(parsed.ok ? parsed.model : EMPTY_MODEL);
    setProblems(parsed.ok ? [] : parsed.problems);
  }

  // Puts in a whole new text at once (AI, import), placing new tables around the ones already arranged.
  function replace(next: Snapshot, newFresh: Fresh = NO_FRESH): LiveChange {
    const parsed = parseDiagram(next.dbml);
    const placed = parsed.ok ? placeTables(parsed.model, next.positions) : next.positions;
    adopt(next.dbml, parsed);
    setFresh(newFresh);
    return change(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, next.dbml);
      writePositions(ymap, placed);
    });
  }

  function withUndo(message: string, edit: LiveChange) {
    toast(message, {
      action: {
        label: 'Undo',
        onClick: () => {
          edit.undo();
          adopt(ytext.toString());
          setFresh(NO_FRESH);
        },
      },
      onDismiss: edit.release,
      onAutoClose: edit.release,
    });
  }

  async function handleAsk(event: FormEvent) {
    event.preventDefault();
    const request = prompt.trim();
    if (!request || thinking) return;
    setThinking(true);
    const before = latest.current;
    try {
      const result = await editWithAi({ spaceId, dbml: before.dbml, prompt: request });
      const parsed = parseDiagram(result.dbml);
      const known = new Set(model.tables.map(({ name }) => name));
      const added = new Set(parsed.ok ? parsed.model.tables.map(({ name }) => name).filter((name) => !known.has(name)) : []);
      const edit = replace({ dbml: result.dbml, positions: before.positions }, { tables: added, lines: tableLines(result.dbml, added) });
      setPrompt('');
      withUndo(result.summary, edit);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setThinking(false);
    }
  }

  function handleImport(dbml: string) {
    setImporting(false);
    const parsed = parseDiagram(dbml);
    const edit = replace({ dbml, positions: parsed.ok ? tidyLayout(parsed.model) : {} });
    const count = parsed.ok ? parsed.model.tables.length : 0;
    withUndo(`Imported ${count} ${count === 1 ? 'table' : 'tables'}`, edit);
  }

  // Stable callbacks (reading the latest state through refs), so typing doesn't re-render the memoised canvas.
  const handleTidy = useCallback(() => {
    const tidy = tidyLayout(modelNow.current);
    const edit = change(() => writePositions(ymap, tidy));
    requestAnimationFrame(() => canvas.current?.fitView());
    toast('Tidied the layout', { action: { label: 'Undo', onClick: edit.undo }, onDismiss: edit.release, onAutoClose: edit.release });
  }, [change, ymap]);

  const handleMove = useCallback(
    (table: string, point: Point) => {
      if (canEdit) move(table, point);
    },
    [canEdit, move],
  );

  const showCode = useCallback(() => setCodeOpen(true), []);

  async function handleExport(kind: ExportKind) {
    const name = (extension: string) => fileName(title, extension);
    try {
      if (kind === 'dbml') downloadText(name('dbml'), text, 'text/plain');
      else if (kind === 'mermaid') downloadText(name('mmd'), toMermaid(model), 'text/plain');
      else if (kind === 'png' || kind === 'svg') downloadDataUrl(name(kind), await (canvas.current as CanvasHandle).toImage(kind));
      else if (kind === 'copy') {
        await navigator.clipboard.writeText(text);
        toast.success('DBML copied');
      } else downloadText(name('sql'), exportSql(text, kind), 'application/sql');
    } catch (error) {
      toast.error((error as Error).message || 'That export failed. Please try again.');
    }
  }

  const empty = model.tables.length === 0 && !text.trim();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3 md:px-5">
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        <ViewOnlyBadgeComponent />
        {canEdit && (
          <span className={cn('text-xs', presence.connected ? 'text-muted-foreground' : 'text-destructive')}>
            {presence.connected ? 'Saved' : 'Offline, changes will sync'}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <PresenceAvatarsComponent />
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
              <FileUp aria-hidden />
              Import
            </Button>
          )}
          <ExportMenuComponent disabled={problems.length > 0 || model.tables.length === 0} onExport={handleExport} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {codeOpen && (
          <section aria-label="DBML code" className="flex w-full shrink-0 flex-col border-r bg-black/40 md:w-[340px]">
            <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
              <span>DBML</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setCodeOpen(false)}>
                <PanelLeftClose aria-hidden />
                Hide
              </Button>
            </div>
            <div className="min-h-0 flex-1">
              <DbmlEditor ytext={ytext} awareness={presence.awareness} problems={problems} fresh={fresh.lines} readOnly={!canEdit} scrollTo={selected} />
            </div>
            {problems.length > 0 && (
              <ul aria-label="Problems" className="max-h-28 overflow-y-auto border-t px-3 py-2 text-xs">
                {problems.slice(0, 5).map(({ line, message }, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="shrink-0 font-semibold text-destructive">Line {line}</span>
                    <span className="text-muted-foreground">{message}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section aria-label="Diagram" className={cn('relative min-w-0 flex-1', codeOpen && 'hidden md:block')}>
          <DiagramCanvas ref={canvas} model={model} positions={positions} fresh={fresh.tables} selected={selected} onSelect={setSelected} onMove={handleMove} onTidy={canEdit ? handleTidy : undefined} readOnly={!canEdit} onShowCode={codeOpen ? undefined : showCode} />
          {empty && canEdit && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto flex max-w-md flex-col items-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">Describe your database below, or write DBML on the left</p>
                {diagram.aiEnabled && (
                  <div className="flex flex-col gap-2">
                    {EXAMPLES.map((example) => (
                      <Button key={example} variant="outline" size="sm" className="h-auto py-1.5 whitespace-normal" onClick={() => setPrompt(example)}>
                        {example}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floats at the bottom centre of the canvas, clear of the zoom controls (top left) and the Assistant button. */}
          {diagram.aiEnabled && canEdit && (
            <form
              onSubmit={handleAsk}
              className="absolute bottom-16 left-1/2 z-10 flex w-[min(36rem,calc(100%-2rem))] -translate-x-1/2 items-center gap-2 rounded-full border bg-popover py-1.5 pr-1.5 pl-4 shadow-lg shadow-black/50 focus-within:border-foreground/30 xl:bottom-5"
            >
              <Sparkles className="size-4 shrink-0 text-signal" aria-hidden />
              <Input
                aria-label="Describe a change"
                placeholder={empty ? 'Describe your database' : 'Describe a change to the diagram'}
                maxLength={1000}
                value={prompt}
                disabled={thinking}
                onChange={(event) => setPrompt(event.target.value)}
                className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
              <Button type="submit" size="icon" aria-label="Apply" className="size-9 shrink-0 rounded-full" disabled={!prompt.trim() || thinking}>
                <ArrowUp aria-hidden />
              </Button>
            </form>
          )}
        </section>
      </div>

      {canEdit && <ImportDialogComponent open={importing} replacing={!empty} onClose={() => setImporting(false)} onImport={handleImport} />}
    </div>
  );
}

export function DiagramPageComponent() {
  const space = useActiveSpace();
  const spaceId = useDiagramSpaceId();
  const presence = useSpacePresence();
  const { data, isPending, isError } = useDiagram();
  const title = space?.title ?? 'Database diagram';
  const [sample] = useState(samplePresence);

  if (isError || presence?.denied) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        {presence?.denied ? 'You no longer have access to this diagram.' : 'Could not load this diagram. Please try again.'}
      </p>
    );
  }

  // The skeleton is only used while loading. Skullet keeps re-measuring everything inside it after every DOM change,
  // which costs ~80 ms per keystroke on a large diagram, so the loaded workspace lives outside it.
  // The text comes from the shared document, so wait until it has synced with the server.
  if (data && !isPending && presence?.synced) {
    return (
      <div className="h-full min-h-[480px]">
        <Workspace key={spaceId} diagram={data} presence={presence} title={title} />
      </div>
    );
  }

  // Skullet wraps its content in two divs of its own; stretch them so the sample workspace fills the page.
  return (
    <div className="h-full min-h-[480px] [&>div]:h-full [&>div>div]:h-full">
      <Skeleton loading label="Loading the diagram">
        <Workspace key="sample" diagram={{ dbml: SAMPLE_DBML, positions: {}, updatedAt: null, aiEnabled: true, version: 0 }} presence={sample} title={title} />
      </Skeleton>
    </div>
  );
}
