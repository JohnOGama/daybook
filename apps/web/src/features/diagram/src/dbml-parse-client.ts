import { type ParseResult, parseDiagram } from './dbml-model';

type Answer = { id: number; result: ParseResult };

// Parsing a large diagram takes around 100 ms, so it runs in a worker and typing never waits for it.
// Without workers (or if the worker fails) it parses on the page instead.
let worker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, { text: string; resolve: (result: ParseResult) => void }>();

function startWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  try {
    const started = new Worker(new URL('./dbml-worker.ts', import.meta.url), { type: 'module' });
    started.addEventListener('message', (event: MessageEvent<Answer>) => {
      waiting.get(event.data.id)?.resolve(event.data.result);
      waiting.delete(event.data.id);
    });
    started.addEventListener('error', () => {
      worker = null;
      for (const { text, resolve } of waiting.values()) resolve(parseDiagram(text));
      waiting.clear();
    });
    return started;
  } catch {
    return null;
  }
}

export function parseInBackground(text: string): Promise<ParseResult> {
  if (worker === undefined) worker = startWorker();
  if (!worker) return Promise.resolve(parseDiagram(text));
  const id = ++nextId;
  const running = worker;
  return new Promise((resolve) => {
    waiting.set(id, { text, resolve });
    running.postMessage({ id, text });
  });
}
