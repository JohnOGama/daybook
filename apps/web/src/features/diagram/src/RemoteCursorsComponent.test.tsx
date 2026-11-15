import { act, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import * as Y from 'yjs';
import type { PresenceMember } from '@/features/spaces';
import { RemoteCursorsComponent } from './RemoteCursorsComponent';

// Another browser's awareness, delivered to ours as the server would relay it.
function remote(mine: Awareness, clientId: number, state: Record<string, unknown>) {
  const theirs = new Awareness(new Y.Doc());
  theirs.clientID = clientId;
  theirs.setLocalState({});
  theirs.setLocalState(state);
  act(() => applyAwarenessUpdate(mine, encodeAwarenessUpdate(theirs, [clientId]), 'server'));
  return theirs;
}
const jane: PresenceMember = { userId: 'u2', name: 'Jane Doe', image: null, access: 'edit', clientIds: [77] };

it("draws a cursor with the member's name at its diagram position", () => {
  const awareness = new Awareness(new Y.Doc());
  render(<RemoteCursorsComponent awareness={awareness} members={[jane]} />);
  remote(awareness, 77, { pointer: { x: 120, y: 80 } });
  const cursor = screen.getByRole('img', { name: 'Jane Doe' });
  expect(cursor).toHaveStyle({ transform: 'translate(120px, 80px)' });
  expect(screen.getByText('Jane Doe')).toBeInTheDocument();
});

it('hides a cursor set to null and never draws your own', () => {
  const awareness = new Awareness(new Y.Doc());
  awareness.setLocalStateField('pointer', { x: 1, y: 1 });
  const me: PresenceMember = { ...jane, userId: 'me', name: 'Me', clientIds: [awareness.clientID] };
  render(<RemoteCursorsComponent awareness={awareness} members={[jane, me]} />);
  const theirs = remote(awareness, 77, { pointer: { x: 5, y: 5 } });
  expect(screen.getAllByRole('img').map((element) => element.getAttribute('aria-label'))).toEqual(['Jane Doe']);
  theirs.setLocalState({ pointer: null });
  act(() => applyAwarenessUpdate(awareness, encodeAwarenessUpdate(theirs, [77]), 'server'));
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('a cursor without a matching member is not drawn', () => {
  const awareness = new Awareness(new Y.Doc());
  render(<RemoteCursorsComponent awareness={awareness} members={[jane]} />);
  remote(awareness, 999, { pointer: { x: 5, y: 5 }, user: { name: 'Mallory' } });
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('ignores a text selection from the code editor and a pointer without numbers', () => {
  const awareness = new Awareness(new Y.Doc());
  render(<RemoteCursorsComponent awareness={awareness} members={[jane, { ...jane, userId: 'u3', name: 'Sam', clientIds: [78] }]} />);
  // y-codemirror keeps the text selection in `cursor`; the canvas pointer is `pointer`.
  remote(awareness, 77, { cursor: { anchor: { type: null }, head: { type: null } } });
  remote(awareness, 78, { pointer: { x: 'left', y: null } });
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
