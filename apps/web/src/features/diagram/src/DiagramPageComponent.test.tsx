import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Ref, useImperativeHandle } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { CanvasHandle } from './DiagramCanvasComponent';
import { exportSql, parseDiagram } from './dbml-model';
import type { Diagram } from './diagram-api';
import { tidyLayout } from './diagram-layout';
import type { DiagramModel, Positions, Problem } from './diagram-types';
import { DiagramPageComponent } from './DiagramPageComponent';
import { toMermaid } from './mermaid-export';
import { SHOP } from './test-fixtures';

const { useDiagram, queue, api, toast, download, toImage } = vi.hoisted(() => ({
  useDiagram: vi.fn(),
  queue: vi.fn(),
  api: { editWithAi: vi.fn() },
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
  download: { downloadText: vi.fn(), downloadDataUrl: vi.fn() },
  toImage: vi.fn(async () => 'data:image/png;base64,AAAA'),
}));

type CanvasProps = { model: DiagramModel; positions: Positions; fresh: Set<string>; onSelect(name: string): void; onTidy(): void; ref?: Ref<CanvasHandle> };
type EditorProps = { value: string; problems: Problem[]; onChange(text: string): void; scrollTo: string | null };

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
  DbmlEditor: ({ value, onChange, scrollTo }: EditorProps) => (
    <>
      <textarea aria-label="DBML" value={value} onChange={(event) => onChange(event.target.value)} />
      <output aria-label="Scrolled to">{scrollTo}</output>
    </>
  ),
}));
vi.mock('../hooks/useDiagram', () => ({ useDiagram, useDiagramSpaceId: () => 's1' }));
vi.mock('../hooks/useDiagramAutosave', () => ({ useDiagramAutosave: () => ({ status: 'saved', queue, flush: vi.fn() }) }));
vi.mock('./diagram-api', async (original) => ({ ...(await original<typeof import('./diagram-api')>()), ...api }));
vi.mock('./download', () => download);
vi.mock('sonner', () => ({ toast }));
vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'Shop database', tool: 'diagram' }),
  useSpaceAccess: () => ({ access: 'edit', canEdit: true, isOwner: true }),
  ViewOnlyBadgeComponent: () => null,
}));

const shopModel = (() => {
  const parsed = parseDiagram(SHOP);
  return parsed.ok ? parsed.model : { tables: [], refs: [] };
})();

const show = (diagram: Partial<Diagram> = {}) => {
  useDiagram.mockReturnValue({ data: { dbml: SHOP, positions: {}, updatedAt: null, aiEnabled: true, ...diagram }, isPending: false, isError: false });
  render(<DiagramPageComponent />);
};
const canvas = () => screen.getByTestId('canvas');
const type = (text: string) => fireEvent.change(screen.getByRole('textbox', { name: 'DBML' }), { target: { value: text } });
const exportItem = async (name: string) => {
  await userEvent.click(screen.getByRole('button', { name: /Export/ }));
  return screen.findByRole('menuitem', { name: new RegExp(name) });
};

beforeEach(() => vi.clearAllMocks());

it('draws the saved diagram and saves typed changes with fresh positions', async () => {
  show();
  expect(canvas()).toHaveAttribute('data-tables', 'users,orders,order_items');
  type(`${SHOP}\n\nTable reviews {\n  id int [pk]\n}`);
  await waitFor(() => expect(canvas()).toHaveAttribute('data-tables', 'users,orders,order_items,reviews'));
  const [saved] = queue.mock.calls.at(-1) as [{ dbml: string; positions: Positions }];
  expect(saved.dbml).toContain('Table reviews');
  expect(Object.keys(saved.positions).sort()).toEqual(['order_items', 'orders', 'reviews', 'users']);
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
  show({ positions: { users: { x: 1, y: 2 }, orders: { x: 400, y: 0 }, order_items: { x: 800, y: 0 } } });
  type(SHOP.replaceAll('users', 'people'));
  await waitFor(() => expect(canvas()).toHaveAttribute('data-positions', 'order_items,orders,people'));
  const [saved] = queue.mock.calls.at(-1) as [{ positions: Positions }];
  expect(saved.positions.users).toBeUndefined();
  expect(saved.positions.orders).toEqual({ x: 400, y: 0 });
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

it('tidies the layout with Undo', async () => {
  show({ positions: { users: { x: 1, y: 2 }, orders: { x: 400, y: 0 }, order_items: { x: 800, y: 0 } } });
  await userEvent.click(screen.getByRole('button', { name: 'Tidy layout' }));
  expect(queue).toHaveBeenLastCalledWith({ dbml: SHOP, positions: tidyLayout(shopModel) });
  const undo = toast.mock.calls.at(-1)?.[1] as { action: { onClick: () => void } };
  act(() => undo.action.onClick());
  expect(queue).toHaveBeenLastCalledWith({ dbml: SHOP, positions: { users: { x: 1, y: 2 }, orders: { x: 400, y: 0 }, order_items: { x: 800, y: 0 } } });
});

it('shows the real diagram once it has loaded, not the sample behind the skeleton', () => {
  useDiagram.mockReturnValue({ data: undefined, isPending: true, isError: false });
  const { rerender } = render(<DiagramPageComponent />);
  useDiagram.mockReturnValue({ data: { dbml: 'Table people {\n  id int [pk]\n}', positions: {}, updatedAt: null, aiEnabled: true }, isPending: false, isError: false });
  rerender(<DiagramPageComponent />);
  // Skullet keeps a hidden copy of the skeleton while it fades the real page in, so look for the real canvas among them.
  expect(screen.getAllByTestId('canvas').map((element) => element.dataset.tables)).toContain('people');
  expect(screen.getByRole('textbox', { name: 'DBML' })).toHaveValue('Table people {\n  id int [pk]\n}');
});
