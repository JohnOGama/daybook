import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { parseDiagram } from './dbml-model';
import { SHOP } from './test-fixtures';
import { placeTables } from './diagram-layout';
import type { DiagramModel } from './diagram-types';
import { DiagramCanvasComponent } from './DiagramCanvasComponent';

const parsed = parseDiagram(SHOP);
const model = (parsed.ok ? parsed.model : null) as DiagramModel;
const positions = placeTables(model, {});
const onSelect = vi.fn();
const onTidy = vi.fn();

const show = (fresh: string[] = []) =>
  render(
    <div style={{ width: 800, height: 600 }}>
      <DiagramCanvasComponent model={model} positions={positions} fresh={new Set(fresh)} selected={null} onSelect={onSelect} onMove={vi.fn()} onTidy={onTidy} />
    </div>,
  );

beforeEach(() => vi.clearAllMocks());

it('draws a card for each table with its columns', () => {
  show();
  const users = within(screen.getByRole('group', { name: 'Table users' }));
  expect(users.getByText('users')).toBeInTheDocument();
  expect(users.getByText('email')).toBeInTheDocument();
  expect(users.getByText('varchar')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Table order_items' })).toBeInTheDocument();
});

it('marks keys and columns that point at other tables', () => {
  show();
  const orders = within(screen.getByRole('group', { name: 'Table orders' }));
  expect(orders.getByLabelText('Primary key')).toBeInTheDocument();
  expect(orders.getByLabelText('Points to users.id')).toBeInTheDocument();
});

it('badges tables the AI just added', () => {
  show(['orders']);
  expect(within(screen.getByRole('group', { name: 'Table orders' })).getByText('NEW')).toBeInTheDocument();
  expect(within(screen.getByRole('group', { name: 'Table users' })).queryByText('NEW')).not.toBeInTheDocument();
});

it('selects a table on click and tidies on request', async () => {
  show();
  // A plain click: d3-drag (inside React Flow) reads the window from mouse-down events, which jsdom leaves empty.
  fireEvent.click(within(screen.getByRole('group', { name: 'Table users' })).getByText('users'));
  expect(onSelect).toHaveBeenCalledWith('users');
  await userEvent.click(screen.getByRole('button', { name: 'Tidy layout' }));
  expect(onTidy).toHaveBeenCalled();
});

it('offers to show the code panel from the toolbar only while it is hidden', async () => {
  const onShowCode = vi.fn();
  const { rerender } = render(
    <div style={{ width: 800, height: 600 }}>
      <DiagramCanvasComponent model={model} positions={positions} fresh={new Set()} selected={null} onSelect={onSelect} onMove={vi.fn()} onTidy={onTidy} />
    </div>,
  );
  expect(screen.queryByRole('button', { name: 'Show code' })).not.toBeInTheDocument();
  rerender(
    <div style={{ width: 800, height: 600 }}>
      <DiagramCanvasComponent model={model} positions={positions} fresh={new Set()} selected={null} onSelect={onSelect} onMove={vi.fn()} onTidy={onTidy} onShowCode={onShowCode} />
    </div>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Show code' }));
  expect(onShowCode).toHaveBeenCalled();
});
