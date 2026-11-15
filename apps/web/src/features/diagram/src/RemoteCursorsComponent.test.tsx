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
  remote(awareness, 77, { cursor: { x: 120, y: 80 } });
  const cursor = screen.getByRole('img', { name: 'Jane Doe' });
  expect(cursor).toHaveStyle({ transform: 'translate(120px, 80px)' });
  expect(screen.getByText('Jane Doe')).toBeInTheDocument();
});

it('hides a cursor set to null and never draws your own', () => {
  const awareness = new Awareness(new Y.Doc());
  awareness.setLocalStateField('cursor', { x: 1, y: 1 });
  const me: PresenceMember = { ...jane, userId: 'me', name: 'Me', clientIds: [awareness.clientID] };
  render(<RemoteCursorsComponent awareness={awareness} members={[jane, me]} />);
  const theirs = remote(awareness, 77, { cursor: { x: 5, y: 5 } });
  expect(screen.getAllByRole('img').map((element) => element.getAttribute('aria-label'))).toEqual(['Jane Doe']);
  theirs.setLocalState({ cursor: null });
  act(() => applyAwarenessUpdate(awareness, encodeAwarenessUpdate(theirs, [77]), 'server'));
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('a cursor without a matching member is not drawn', () => {
  const awareness = new Awareness(new Y.Doc());
  render(<RemoteCursorsComponent awareness={awareness} members={[jane]} />);
  remote(awareness, 999, { cursor: { x: 5, y: 5 }, user: { name: 'Mallory' } });
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});
