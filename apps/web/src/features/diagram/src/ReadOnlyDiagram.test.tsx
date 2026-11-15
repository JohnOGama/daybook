import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import type { SpacePresence } from '@/features/spaces';
import { DiagramPageComponent } from './DiagramPageComponent';
import { SHOP } from './test-fixtures';

const { state } = vi.hoisted(() => ({ state: { presence: null as SpacePresence | null } }));

vi.mock('./diagram-parts', () => ({
  DiagramCanvas: ({ onTidy, onMove, readOnly }: { onTidy?: () => void; onMove(t: string, p: { x: number; y: number }): void; readOnly?: boolean }) => (
    <div data-testid="canvas" data-readonly={String(readOnly)}>
      {onTidy && (
        <button type="button" onClick={onTidy}>
          Tidy layout
        </button>
      )}
      <button type="button" onClick={() => onMove('users', { x: 5, y: 5 })}>
        Drag users
      </button>
    </div>
  ),
  DbmlEditor: ({ readOnly }: { readOnly?: boolean }) => <textarea aria-label="DBML" readOnly={readOnly} />,
}));
vi.mock('../hooks/useDiagram', () => ({
  useDiagram: () => ({ data: { dbml: '', positions: {}, updatedAt: null, aiEnabled: true, version: 1 }, isPending: false, isError: false }),
  useDiagramSpaceId: () => 's1',
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'Shop database', tool: 'diagram' }),
  useSpaceAccess: () => ({ access: 'view', canEdit: false, isOwner: false }),
  useSpacePresence: () => state.presence,
  PresenceAvatarsComponent: () => null,
  ViewOnlyBadgeComponent: () => <span>View only</span>,
}));

beforeEach(() => vi.clearAllMocks());

it('gives a viewer the diagram and exports but no way to change it, and never writes to the shared document', async () => {
  // Positions for only one table, so an editor would place and write the other two.
  const doc = new Y.Doc();
  doc.getText('dbml').insert(0, SHOP);
  doc.getMap('positions').set('users', { x: 0, y: 0 });
  state.presence = { doc, awareness: new Awareness(doc), members: [], connected: true, synced: true };
  let writes = 0;
  doc.on('update', () => writes++);

  render(<DiagramPageComponent />);
  expect(screen.getByText('View only')).toBeInTheDocument();
  expect(screen.getByTestId('canvas')).toHaveAttribute('data-readonly', 'true');
  expect(screen.getByRole('textbox', { name: 'DBML' })).toHaveAttribute('readonly');
  expect(screen.queryByRole('textbox', { name: 'Describe a change' })).not.toBeInTheDocument();
  for (const name of ['Import', 'Tidy layout', 'Apply']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Export/ })).toBeEnabled();
  expect(screen.queryByText('Saved')).not.toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Drag users' }));
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(writes).toBe(0);
});
