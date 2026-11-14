'use client';

import { ArrowUp, FileUp, PanelLeftClose, Sparkles } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Skeleton } from 'skullet/react';
import { toast } from 'sonner';
import { useActiveSpace } from '@/features/spaces';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/utils/cn';
import { useDiagram, useDiagramSpaceId } from '../hooks/useDiagram';
import { type SaveStatus, useDiagramAutosave } from '../hooks/useDiagramAutosave';
import type { LineRange } from './DbmlEditorComponent';
import type { CanvasHandle } from './DiagramCanvasComponent';
import { exportSql, parseDiagram } from './dbml-model';
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
const STATUS_LABEL: Record<SaveStatus, string> = { saved: 'Saved', saving: 'Saving…', error: 'Not saved' };

type Snapshot = { dbml: string; positions: Positions };
type Fresh = { tables: Set<string>; lines: LineRange[] };
const NO_FRESH: Fresh = { tables: new Set(), lines: [] };

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

function Workspace({ diagram, title }: { diagram: Diagram; title: string }) {
  const spaceId = useDiagramSpaceId() as string;
  const { status, queue } = useDiagramAutosave(spaceId);
  const canvas = useRef<CanvasHandle>(null);

  // Read once; afterwards the text lives here and the cache only follows it.
  const [first] = useState(() => parseDiagram(diagram.dbml));
  const [text, setText] = useState(diagram.dbml);
  const [model, setModel] = useState<DiagramModel>(first.ok ? first.model : EMPTY_MODEL);
  const [problems, setProblems] = useState<Problem[]>(first.ok ? [] : first.problems);
  const [positions, setPositions] = useState<Positions>(() => (first.ok ? placeTables(first.model, diagram.positions) : diagram.positions));
  const [fresh, setFresh] = useState<Fresh>(NO_FRESH);
  const [selected, setSelected] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(wideScreen);
  const [prompt, setPrompt] = useState('');
  const [thinking, setThinking] = useState(false);
  const [importing, setImporting] = useState(false);
  const typed = useRef(false);
  const latest = useRef<Snapshot>({ dbml: text, positions });
  latest.current = { dbml: text, positions };

  // Reads the text as the owner types; a broken text keeps the last diagram that worked on screen.
  useEffect(() => {
    if (!typed.current) return;
    const timer = setTimeout(() => {
      const parsed = parseDiagram(text);
      if (!parsed.ok) {
        setProblems(parsed.problems);
        queue({ dbml: text, positions: latest.current.positions });
        return;
      }
      const placed = placeTables(parsed.model, latest.current.positions);
      setModel(parsed.model);
      setProblems([]);
      setPositions(placed);
      queue({ dbml: text, positions: placed });
    }, PARSE_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [text, queue]);

  // Puts in a whole new text at once (AI, import, undo), placing new tables around the ones already arranged.
  function replace(next: Snapshot, newFresh: Fresh = NO_FRESH) {
    typed.current = false;
    const parsed = parseDiagram(next.dbml);
    const placed = parsed.ok ? placeTables(parsed.model, next.positions) : next.positions;
    setText(next.dbml);
    setModel(parsed.ok ? parsed.model : EMPTY_MODEL);
    setProblems(parsed.ok ? [] : parsed.problems);
    setPositions(placed);
    setFresh(newFresh);
    queue({ dbml: next.dbml, positions: placed });
  }

  function withUndo(message: string, before: Snapshot) {
    toast(message, { action: { label: 'Undo', onClick: () => replace(before) } });
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
      replace({ dbml: result.dbml, positions: before.positions }, { tables: added, lines: tableLines(result.dbml, added) });
      setPrompt('');
      withUndo(result.summary, before);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setThinking(false);
    }
  }

  function handleImport(dbml: string) {
    const before = latest.current;
    setImporting(false);
    const parsed = parseDiagram(dbml);
    replace({ dbml, positions: parsed.ok ? tidyLayout(parsed.model) : {} });
    const count = parsed.ok ? parsed.model.tables.length : 0;
    withUndo(`Imported ${count} ${count === 1 ? 'table' : 'tables'}`, before);
  }

  function handleTidy() {
    const before = latest.current;
    const tidy = tidyLayout(model);
    setPositions(tidy);
    queue({ dbml: text, positions: tidy });
    requestAnimationFrame(() => canvas.current?.fitView());
    toast('Tidied the layout', { action: { label: 'Undo', onClick: () => { setPositions(before.positions); queue(before); } } });
  }

  function handleMove(table: string, point: Point) {
    const next = { ...latest.current.positions, [table]: point };
    setPositions(next);
    queue({ dbml: latest.current.dbml, positions: next });
  }

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
        <span className={cn('text-xs', status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{STATUS_LABEL[status]}</span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
            <FileUp aria-hidden />
            Import
          </Button>
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
              <DbmlEditor
                value={text}
                problems={problems}
                fresh={fresh.lines}
                scrollTo={selected}
                onChange={(next: string) => {
                  typed.current = true;
                  setFresh(NO_FRESH);
                  setText(next);
                }}
              />
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
          <DiagramCanvas ref={canvas} model={model} positions={positions} fresh={fresh.tables} selected={selected} onSelect={setSelected} onMove={handleMove} onTidy={handleTidy} onShowCode={codeOpen ? undefined : () => setCodeOpen(true)} />
          {empty && (
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
          {diagram.aiEnabled && (
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

      <ImportDialogComponent open={importing} replacing={!empty} onClose={() => setImporting(false)} onImport={handleImport} />
    </div>
  );
}

export function DiagramPageComponent() {
  const space = useActiveSpace();
  const spaceId = useDiagramSpaceId();
  const { data, isPending, isError } = useDiagram();
  const title = space?.title ?? 'Database diagram';

  if (isError) {
    return (
      <p role="alert" className="px-6 py-8 text-sm text-destructive">
        Could not load this diagram. Please try again.
      </p>
    );
  }

  // Skullet wraps its content in two divs of its own; stretch them so the workspace can fill the page.
  return (
    <div className="h-full min-h-[480px] [&>div]:h-full [&>div>div]:h-full">
      <Skeleton loading={isPending} label="Loading the diagram">
        {/* A different key for the sample, so the real diagram starts fresh when it arrives. */}
        <Workspace key={data ? spaceId : 'sample'} diagram={data ?? { dbml: SAMPLE_DBML, positions: {}, updatedAt: null, aiEnabled: true }} title={title} />
      </Skeleton>
    </div>
  );
}
