import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectJenkinsDialogComponent } from './ConnectJenkinsDialogComponent';
import { markAdded } from './jenkinsfile-lines';

const KEY = 'dbk_7Qm2c9VxR4tLp0Hs8aZe1Wn6Ku3Jy5Db';
const PASTED = "pipeline {\n  agent any\n  stages {\n    stage('Test') {\n      steps {\n        sh 'pnpm test'\n      }\n    }\n  }\n}";
const RESULT = PASTED.replace('  agent any', "  agent any\n  environment { DAYBOOK_KEY = credentials('DAYBOOK_KEY') }").replace("        sh 'pnpm test'", "        daybook('Test', 'started')\n        sh 'pnpm test'");

type Route = { status?: number; body?: unknown };
let routes: Record<string, Route | (() => Route)>;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  const route = routes[`${init?.method ?? 'GET'} ${url}`];
  const { status = 200, body = null } = typeof route === 'function' ? route() : (route ?? { status: 404 });
  return new Response(body === null ? 'null' : JSON.stringify(body), { status });
});

function renderDialog(isOwner = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ConnectJenkinsDialogComponent open onOpenChange={() => undefined} spaceId="s1" spaceTitle="Backend" isOwner={isOwner} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  routes = {
    'GET /api/pipelines/s1/key': { body: null },
    'POST /api/pipelines/s1/key': { status: 201, body: { key: KEY } },
    'POST /api/pipelines/ai/instrument': { status: 201, body: { jenkinsfile: RESULT, summary: 'Added reporting to 1 stage.' } },
  };
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('ConnectJenkinsDialogComponent', () => {
  it('the owner makes a key and sees it once; reopening shows only dates', async () => {
    renderDialog();
    expect(await screen.findByText('Not made yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Make a key' }));
    expect(await screen.findByDisplayValue(KEY)).toBeInTheDocument();
    expect(screen.getByText('Shown once. Daybook keeps only a hash of it; if you lose it, make a new one.')).toBeInTheDocument();
  });

  it('shows when the key was made and last used, without the key', async () => {
    routes['GET /api/pipelines/s1/key'] = { body: { createdAt: '2026-11-10T09:00:00Z', lastUsedAt: '2026-11-16T09:59:00Z' } };
    renderDialog();
    expect(await screen.findByText(/^Made /)).toHaveTextContent(/last used/);
    expect(screen.queryByDisplayValue(/^dbk_/)).not.toBeInTheDocument();
  });

  it('replacing asks first', async () => {
    routes['GET /api/pipelines/s1/key'] = { body: { createdAt: '2026-11-10T09:00:00Z', lastUsedAt: null } };
    renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Replace key' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent('The old key stops working at once');
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Replace' }));
    expect(await screen.findByDisplayValue(KEY)).toBeInTheDocument();
  });

  it('an editor sees the AI section but no key section', () => {
    renderDialog(false);
    expect(screen.getByRole('textbox', { name: 'Your production Jenkinsfile' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Key' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/key'))).toBe(false);
  });

  it('marks added lines and counts them', async () => {
    renderDialog();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your production Jenkinsfile' }), { target: { value: PASTED } });
    await userEvent.click(screen.getByRole('button', { name: 'Add Daybook reporting' }));
    const result = await screen.findByRole('region', { name: 'With Daybook reporting' });
    expect(within(result).getByText('+2 lines')).toBeInTheDocument();
    const added = result.querySelectorAll('[data-added="true"]');
    expect([...added].map((line) => line.textContent?.trim())).toEqual(["environment { DAYBOOK_KEY = credentials('DAYBOOK_KEY') }", "daybook('Test', 'started')"]);
    expect(screen.getByText('Only this text goes to the AI, never your key. Take any passwords or tokens written in the file out first.')).toBeInTheDocument();
  });

  it('shows the refusal with the helper snippet to add by hand', async () => {
    routes['POST /api/pipelines/ai/instrument'] = { status: 502, body: { message: 'The AI changed your existing steps, so nothing was added. Try again, or add the lines by hand.' } };
    renderDialog();
    fireEvent.change(screen.getByRole('textbox', { name: 'Your production Jenkinsfile' }), { target: { value: PASTED } });
    await userEvent.click(screen.getByRole('button', { name: 'Add Daybook reporting' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The AI changed your existing steps');
    expect(screen.getByRole('region', { name: 'Add by hand' })).toHaveTextContent('def daybook(String stage');
  });

  it('the key is not in the request sent to the AI route', async () => {
    renderDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Make a key' }));
    await screen.findByDisplayValue(KEY);
    fireEvent.change(screen.getByRole('textbox', { name: 'Your production Jenkinsfile' }), { target: { value: PASTED } });
    await userEvent.click(screen.getByRole('button', { name: 'Add Daybook reporting' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === '/api/pipelines/ai/instrument')).toBe(true));
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/pipelines/ai/instrument') as [string, RequestInit];
    expect(String(init.body)).not.toContain(KEY);
    expect(JSON.parse(String(init.body))).toEqual({ spaceId: 's1', jenkinsfile: PASTED });
  });
});

describe('markAdded', () => {
  it('marks only the lines the result added, ignoring CRLF and trailing spaces', () => {
    const marked = markAdded(PASTED.replaceAll('\n', '\r\n'), RESULT);
    expect(marked.filter((line) => line.added).map((line) => line.text.trim())).toEqual(["environment { DAYBOOK_KEY = credentials('DAYBOOK_KEY') }", "daybook('Test', 'started')"]);
    expect(marked.map((line) => line.text).join('\n')).toBe(RESULT);
  });
});
