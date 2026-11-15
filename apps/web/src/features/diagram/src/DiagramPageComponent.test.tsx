import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Ref, useEffect, useImperativeHandle, useState } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import type { SpacePresence } from '@/features/spaces';
import type { CanvasHandle } from './DiagramCanvasComponent';
import { exportSql, parseDiagram } from './dbml-model';
import type { Diagram } from './diagram-api';
import { tidyLayout } from './diagram-layout';
import type { DiagramModel, Positions, Problem } from './diagram-types';
import { DiagramPageComponent } from './DiagramPageComponent';
import { toMermaid } from './mermaid-export';
import { SHOP } from './test-fixtures';

const { useDiagram, api, toast, download, toImage, state } = vi.hoisted(() => ({
  useDiagram: vi.fn(),
  api: { editWithAi: vi.fn() },
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
  download: { downloadText: vi.fn(), downloadDataUrl: vi.fn() },
  toImage: vi.fn(async () => 'data:image/png;base64,AAAA'),
  state: { presence: null as SpacePresence | null },
}));

type CanvasProps = { model: DiagramModel; positions: Positions; fresh: Set<string>; onSelect(name: string): void; onTidy(): void; ref?: Ref<CanvasHandle> };
type EditorProps = { ytext: Y.Text; problems: Problem[]; scrollTo: string | null };

// Stands in for CodeMirror bound with yCollab: shows the shared text and writes typing straight into it.
function FakeEditor({ ytext }: { ytext: Y.Text }) {
  const [value, setValue] = useState(() => ytext.toString());
  useEffect(() => {
    const read = () => setValue(ytext.toString());
    ytext.observe(read);
    return () => ytext.unobserve(read);
  }, [ytext]);
  return (
    <textarea
      aria-label="DBML"
      value={value}
      onChange={(event) =>
        ytext.doc?.transact(() => {
          ytext.delete(0, ytext.length);
          ytext.insert(0, event.target.value);
        })
      }
    />
  );
}

vi.mock('./diagram-parts', () => ({
  DiagramCanvas: ({ model, positions, fresh, onSelect, onTidy, ref }: CanvasProps) => {
    useImperativeHandle(ref, () => ({ fitView: vi.fn(), toImage }));
    return (
      <div data-testid="canvas" data-tables={model.tables.map(({ name }) => name).join(',')} data-fresh={[...fresh].join(',')} data-positions={Object.keys(positions).sort().join(',')}>
        <button type="button" onClick={() => onSelect('users')}>
          Pick users
        </button>
        <button type="button" onClick={onTidy}>
          Tidy layout
        </button>
      </div>
    );
  },
  DbmlEditor: ({ ytext, scrollTo }: EditorProps) => (
    <>
      <FakeEditor ytext={ytext} />
      <output aria-label="Scrolled to">{scrollTo}</output>
    </>
  ),
}));
vi.mock('../hooks/useDiagram', () => ({ useDiagram, useDiagramSpaceId: () => 's1' }));
vi.mock('./diagram-api', async (original) => ({ ...(await original<typeof import('./diagram-api')>()), ...api }));
vi.mock('./download', () => download);
vi.mock('sonner', () => ({ toast }));
vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'Shop database', tool: 'diagram' }),
  useSpaceAccess: () => ({ access: 'edit', canEdit: true, isOwner: true }),
  useSpacePresence: () => state.presence,
  PresenceAvatarsComponent: () => null,
  ViewOnlyBadgeComponent: () => null,
}));

const shopModel = (() => {
  const parsed = parseDiagram(SHOP);
  return parsed.ok ? parsed.model : { tables: [], refs: [] };
})();

// The shared document as the server would hand it over: the text and positions, already synced.
function connect({ dbml = SHOP, positions = {} as Positions } = {}, status: Partial<SpacePresence> = {}) {
  const doc = new Y.Doc();
  doc.getText('dbml').insert(0, dbml);
  for (const [name, point] of Object.entries(positions)) doc.getMap('positions').set(name, point);
  state.presence = { doc, awareness: new Awareness(doc), members: [], connected: true, synced: true, denied: false, ...status };
  return doc;
}
const show = (diagram: Partial<Diagram> = {}) => {
  const doc = connect({ dbml: diagram.dbml, positions: diagram.positions });
  useDiagram.mockReturnValue({ data: { dbml: '', positions: {}, updatedAt: null, aiEnabled: true, version: 1, ...diagram }, isPending: false, isError: false });
  render(<DiagramPageComponent />);
  return doc;
};
const shared = (doc: Y.Doc) => ({ text: doc.getText('dbml').toString(), positions: doc.getMap('positions').toJSON() as Positions });
const canvas = () => screen.getByTestId('canvas');
const type = (text: string) => fireEvent.change(screen.getByRole('textbox', { name: 'DBML' }), { target: { value: text } });
const exportItem = async (name: string) => {
  await userEvent.click(screen.getByRole('button', { name: /Export/ }));
  return screen.findByRole('menuitem', { name: new RegExp(name) });
};

beforeEach(() => vi.clearAllMocks());

it('draws the shared diagram and writes typed changes and fresh positions into it', async () => {
  const doc = show();
  expect(canvas()).toHaveAttribute('data-tables', 'users,orders,order_items');
  type(`${SHOP}\n\nTable reviews {\n  id int [pk]\n}`);
  await waitFor(() => expect(canvas()).toHaveAttribute('data-tables', 'users,orders,order_items,reviews'));
  expect(shared(doc).text).toContain('Table reviews');
  await waitFor(() => expect(Object.keys(shared(doc).positions).sort()).toEqual(['order_items', 'orders', 'reviews', 'users']));
});

it('redraws when someone else changes the text', async () => {
  const doc = show();
  act(() => doc.getText('dbml').insert(doc.getText('dbml').length, '\n\nTable tags {\n  id int [pk]\n}'));
  await waitFor(() => expect(canvas()).toHaveAttribute('data-tables', 'users,orders,order_items,tags'));
  expect(screen.getByRole('textbox', { name: 'DBML' })).toHaveValue(`${SHOP}\n\nTable tags {\n  id int [pk]\n}`);
});

it('says so when the connection ended because you lost access, instead of loading forever', () => {
  connect({}, { synced: false, denied: true });
  useDiagram.mockReturnValue({ data: { dbml: '', positions: {}, updatedAt: null, aiEnabled: true, version: 1 }, isPending: false, isError: false });
  render(<DiagramPageComponent />);
  expect(screen.getByRole('alert')).toHaveTextContent('You no longer have access to this diagram.');
});

it('shows the skeleton until the shared document has synced', () => {
  connect({}, { synced: false });
  useDiagram.mockReturnValue({ data: { dbml: '', positions: {}, updatedAt: null, aiEnabled: true, version: 1 }, isPending: false, isError: false });
  render(<DiagramPageComponent />);
  expect(screen.getAllByTestId('canvas').map((element) => element.dataset.tables)).not.toContain('users,orders,order_items');
});

it('shows Saved while connected', () => {
  show();
  expect(screen.getByText('Saved')).toBeInTheDocument();
});

it('says changes will sync while offline', () => {
  connect({}, { connected: false });
  useDiagram.mockReturnValue({ data: { dbml: '', positions: {}, updatedAt: null, aiEnabled: true, version: 1 }, isPending: false, isError: false });
  render(<DiagramPageComponent />);
  expect(screen.getByText('Offline, changes will sync')).toBeInTheDocument();
});

it('shows problems for text that never parsed, with an empty canvas and no exports', async () => {
  show({ dbml: '' });
  type('Table users {');
  expect(await screen.findByText(/Line 1/)).toBeInTheDocument();
  expect(canvas()).toHaveAttribute('data-tables', '');
  for (const name of ['^DBML', 'Mermaid', 'PostgreSQL', 'PNG']) {
    expect(await exportItem(name)).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Escape}');
  }
});

it('keeps the last good diagram while the text is broken', async () => {
  show();
  type(`${SHOP}\nTable broken {`);
  expect(await screen.findByText(/Line \d+/)).toBeInTheDocument();
  expect(canvas()).toHaveAttribute('data-tables', 'users,orders,order_items');
});

it('places a renamed table afresh and forgets the old name', async () => {
  const doc = show({ positions: { users: { x: 1, y: 2 }, orders: { x: 400, y: 0 }, order_items: { x: 800, y: 0 } } });
  type(SHOP.replaceAll('users', 'people'));
  await waitFor(() => expect(canvas()).toHaveAttribute('data-positions', 'order_items,orders,people'));
  await waitFor(() => expect(shared(doc).positions.users).toBeUndefined());
  expect(shared(doc).positions.orders).toEqual({ x: 400, y: 0 });
});

it('helps with an empty diagram', async () => {
  show({ dbml: '' });
  expect(screen.getByText('Describe your database below, or write DBML on the left')).toBeInTheDocument();
  const examples = screen.getAllByRole('button', { name: /^An? / });
  expect(examples).toHaveLength(3);
  await userEvent.click(examples[0]);
  expect(screen.getByRole('textbox', { name: 'Describe a change' })).toHaveValue(examples[0].textContent);
});

it('applies an AI change, marks what is new, and undoes it', async () => {
  const next = `${SHOP}\n\nTable reviews {\n  id int [pk]\n  user_id int [ref: > users.id]\n}`;
  api.editWithAi.mockResolvedValue({ dbml: next, summary: 'Added reviews.' });
  show();
  await userEvent.type(screen.getByRole('textbox', { name: 'Describe a change' }), 'Add reviews');
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(api.editWithAi).toHaveBeenCalledWith({ spaceId: 's1', dbml: SHOP, prompt: 'Add reviews' });
  await waitFor(() => expect(canvas()).toHaveAttribute('data-fresh', 'reviews'));
  expect(screen.getByRole('textbox', { name: 'DBML' })).toHaveValue(next);
  expect(toast).toHaveBeenCalledWith('Added reviews.', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
  const undo = toast.mock.calls.at(-1)?.[1] as { action: { onClick: () => void } };
  act(() => undo.action.onClick());
  expect(screen.getByRole('textbox', { name: 'DBML' })).toHaveValue(SHOP);
  expect(canvas()).toHaveAttribute('data-fresh', '');
});

it("AI change Undo restores the text but keeps a collaborator's later edit to positions", async () => {
  const next = `${SHOP}\n\nTable reviews {\n  id int [pk]\n}`;
  api.editWithAi.mockResolvedValue({ dbml: next, summary: 'Added reviews.' });
  const doc = show({ positions: { users: { x: 1, y: 2 }, orders: { x: 400, y: 0 }, order_items: { x: 800, y: 0 } } });
  await userEvent.type(screen.getByRole('textbox', { name: 'Describe a change' }), 'Add reviews');
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(shared(doc).text).toBe(next));
  // Someone else moves a table after the AI change, from their own browser.
  const theirs = new Y.Doc();
  Y.applyUpdate(theirs, Y.encodeStateAsUpdate(doc));
  theirs.getMap('positions').set('orders', { x: 999, y: 9 });
  act(() => Y.applyUpdate(doc, Y.encodeStateAsUpdate(theirs, Y.encodeStateVector(doc))));
  const undo = toast.mock.calls.at(-1)?.[1] as { action: { onClick: () => void } };
  act(() => undo.action.onClick());
  expect(shared(doc).text).toBe(SHOP);
  expect(shared(doc).positions.orders).toEqual({ x: 999, y: 9 });
});

it('reports an AI failure and keeps the diagram, and hides the prompt with AI off', async () => {
  api.editWithAi.mockRejectedValue(new Error("The AI couldn't produce a valid diagram for that. Try rewording it."));
  show();
  await userEvent.type(screen.getByRole('textbox', { name: 'Describe a change' }), 'Something');
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The AI couldn't produce a valid diagram for that. Try rewording it."));
  expect(screen.getByRole('textbox', { name: 'DBML' })).toHaveValue(SHOP);
});

it('has no prompt when AI is off', () => {
  show({ aiEnabled: false });
  expect(screen.queryByRole('textbox', { name: 'Describe a change' })).not.toBeInTheDocument();
});

it('imports SQL in place of the diagram, with Undo, and shows SQL it cannot read', async () => {
  show();
  await userEvent.click(screen.getByRole('button', { name: /Import/ }));
  const dialog = within(await screen.findByRole('dialog'));
  expect(dialog.getByText(/This replaces the current diagram/)).toBeInTheDocument();
  await userEvent.click(dialog.getByRole('radio', { name: 'PostgreSQL' }));
  fireEvent.change(dialog.getByLabelText('Schema to import'), { target: { value: 'CREATE TABL oops' } });
  await userEvent.click(dialog.getByRole('button', { name: 'Import' }));
  expect(dialog.getByText(/Line 1/)).toBeInTheDocument();
  expect(canvas()).toHaveAttribute('data-tables', 'users,orders,order_items');
  fireEvent.change(dialog.getByLabelText('Schema to import'), { target: { value: 'CREATE TABLE people (id serial PRIMARY KEY);' } });
  await userEvent.click(dialog.getByRole('button', { name: 'Import' }));
  await waitFor(() => expect(canvas()).toHaveAttribute('data-tables', 'people'));
  expect(toast).toHaveBeenCalledWith('Imported 1 table', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
});

it('exports each format under the space name', async () => {
  const clipboard = vi.fn(async () => undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: clipboard }, configurable: true });
  show();
  await userEvent.click(await exportItem('PostgreSQL'));
  expect(download.downloadText).toHaveBeenCalledWith('shop-database.sql', exportSql(SHOP, 'postgres'), 'application/sql');
  await userEvent.click(await exportItem('Mermaid'));
  expect(download.downloadText).toHaveBeenCalledWith('shop-database.mmd', toMermaid(shopModel), 'text/plain');
  await userEvent.click(await exportItem('^DBML'));
  expect(download.downloadText).toHaveBeenCalledWith('shop-database.dbml', SHOP, 'text/plain');
  await userEvent.click(await exportItem('PNG'));
  await waitFor(() => expect(download.downloadDataUrl).toHaveBeenCalledWith('shop-database.png', 'data:image/png;base64,AAAA'));
  expect(toImage).toHaveBeenCalledWith('png');
  await userEvent.click(await exportItem('Copy DBML'));
  expect(clipboard).toHaveBeenCalledWith(SHOP);
});

it('scrolls the code to a table picked on the canvas', async () => {
  show();
  await userEvent.click(screen.getByRole('button', { name: 'Pick users' }));
  expect(screen.getByRole('status', { name: 'Scrolled to' })).toHaveTextContent('users');
});

it('tidies the layout into the shared positions, with Undo', async () => {
  const before = { users: { x: 1, y: 2 }, orders: { x: 400, y: 0 }, order_items: { x: 800, y: 0 } };
  const doc = show({ positions: before });
  await userEvent.click(screen.getByRole('button', { name: 'Tidy layout' }));
  expect(shared(doc).positions).toEqual(tidyLayout(shopModel));
  const undo = toast.mock.calls.at(-1)?.[1] as { action: { onClick: () => void } };
  act(() => undo.action.onClick());
  expect(shared(doc).positions).toEqual(before);
});

it('shows the real diagram once it has loaded, not the sample behind the skeleton', () => {
  connect({ dbml: 'Table people {\n  id int [pk]\n}' });
  useDiagram.mockReturnValue({ data: undefined, isPending: true, isError: false });
  const { rerender } = render(<DiagramPageComponent />);
  useDiagram.mockReturnValue({ data: { dbml: '', positions: {}, updatedAt: null, aiEnabled: true, version: 1 }, isPending: false, isError: false });
  rerender(<DiagramPageComponent />);
  // Skullet keeps a hidden copy of the skeleton while it fades the real page in, so look for the real canvas among them.
  expect(screen.getAllByTestId('canvas').map((element) => element.dataset.tables)).toContain('people');
  expect(screen.getByRole('textbox', { name: 'DBML' })).toHaveValue('Table people {\n  id int [pk]\n}');
});
