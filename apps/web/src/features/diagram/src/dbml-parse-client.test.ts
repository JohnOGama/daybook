import { afterEach, expect, it, vi } from 'vitest';
import { parseDiagram } from './dbml-model';
import { SHOP } from './test-fixtures';

// A fresh copy of the module for each test, since it keeps one worker for the page's lifetime.
const load = async () => {
  vi.resetModules();
  return (await import('./dbml-parse-client')).parseInBackground;
};

afterEach(() => vi.unstubAllGlobals());

it('parses on the page when the browser has no workers', async () => {
  vi.stubGlobal('Worker', undefined);
  const parseInBackground = await load();
  expect(await parseInBackground(SHOP)).toEqual(parseDiagram(SHOP));
});

it('sends the text to a worker and resolves each request with its own answer', async () => {
  const posted: { id: number; text: string }[] = [];
  let reply: (data: unknown) => void = () => {};
  class FakeWorker {
    addEventListener(type: string, listener: (event: { data: unknown }) => void) {
      if (type === 'message') reply = (data) => listener({ data });
    }
    postMessage(message: { id: number; text: string }) {
      posted.push(message);
    }
  }
  vi.stubGlobal('Worker', FakeWorker);
  const parseInBackground = await load();
  const first = parseInBackground('Table a { id int }');
  const second = parseInBackground('Table b { id int }');
  expect(posted.map(({ text }) => text)).toEqual(['Table a { id int }', 'Table b { id int }']);
  reply({ id: posted[1].id, result: { ok: true, model: { tables: [{ name: 'b', columns: [] }], refs: [] } } });
  reply({ id: posted[0].id, result: { ok: true, model: { tables: [{ name: 'a', columns: [] }], refs: [] } } });
  expect(await first).toMatchObject({ model: { tables: [{ name: 'a' }] } });
  expect(await second).toMatchObject({ model: { tables: [{ name: 'b' }] } });
});

it('falls back to parsing on the page when the worker fails', async () => {
  let fail: () => void = () => {};
  class BrokenWorker {
    addEventListener(type: string, listener: () => void) {
      if (type === 'error') fail = listener;
    }
    postMessage() {}
  }
  vi.stubGlobal('Worker', BrokenWorker);
  const parseInBackground = await load();
  const pending = parseInBackground(SHOP);
  fail();
  expect(await pending).toEqual(parseDiagram(SHOP));
  expect(await parseInBackground('Table c { id int }')).toEqual(parseDiagram('Table c { id int }'));
});
