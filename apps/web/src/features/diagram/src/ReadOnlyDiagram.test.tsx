import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { DiagramPageComponent } from './DiagramPageComponent';
import { SHOP } from './test-fixtures';

const { queue } = vi.hoisted(() => ({ queue: vi.fn() }));

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
  DbmlEditor: ({ value, onChange, readOnly }: { value: string; onChange(t: string): void; readOnly?: boolean }) => (
    <textarea aria-label="DBML" value={value} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} />
  ),
}));
vi.mock('../hooks/useDiagram', () => ({
  useDiagram: () => ({ data: { dbml: SHOP, positions: {}, updatedAt: null, aiEnabled: true, version: 1 }, isPending: false, isError: false }),
  useDiagramSpaceId: () => 's1',
}));
vi.mock('../hooks/useDiagramAutosave', () => ({ useDiagramAutosave: () => ({ status: 'saved', queue, flush: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('@/features/spaces', () => ({
  useActiveSpace: () => ({ id: 's1', title: 'Shop database', tool: 'diagram' }),
  useSpaceAccess: () => ({ access: 'view', canEdit: false, isOwner: false }),
  PresenceAvatarsComponent: () => null,
  ViewOnlyBadgeComponent: () => <span>View only</span>,
}));

beforeEach(() => vi.clearAllMocks());

it('gives a viewer the diagram and exports but no way to change or save it', async () => {
  render(<DiagramPageComponent />);
  expect(screen.getByText('View only')).toBeInTheDocument();
  expect(screen.getByTestId('canvas')).toHaveAttribute('data-readonly', 'true');
  expect(screen.getByRole('textbox', { name: 'DBML' })).toHaveAttribute('readonly');
  expect(screen.queryByRole('textbox', { name: 'Describe a change' })).not.toBeInTheDocument();
  for (const name of ['Import', 'Tidy layout', 'Apply']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Export/ })).toBeEnabled();

  fireEvent.change(screen.getByRole('textbox', { name: 'DBML' }), { target: { value: `${SHOP}\nTable x {\n id int\n}` } });
  await userEvent.click(screen.getByRole('button', { name: 'Drag users' }));
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(queue).not.toHaveBeenCalled();
});
