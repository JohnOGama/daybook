'use client';

import { MousePointer2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Awareness } from 'y-protocols/awareness';
import type { PresenceMember } from '@/features/spaces';
import type { Point } from './diagram-types';

type Cursor = { clientId: number; name: string; at: Point };

function cursorsOf(awareness: Awareness, members: PresenceMember[]): Cursor[] {
  const nameOf = new Map(members.flatMap((member) => member.clientIds.map((id): [number, string] => [id, member.name])));
  const cursors: Cursor[] = [];
  awareness.getStates().forEach((state, clientId) => {
    // `pointer`, not `cursor`: y-codemirror keeps the code editor's text selection in `cursor`.
    const at = (state as { pointer?: Partial<Point> | null }).pointer;
    // The name comes only from the server's member list; a tab it doesn't know is not drawn.
    const name = nameOf.get(clientId);
    if (clientId !== awareness.clientID && name && Number.isFinite(at?.x) && Number.isFinite(at?.y)) cursors.push({ clientId, name, at: at as Point });
  });
  return cursors;
}

// Other people's pointers, in diagram coordinates (drawn inside React Flow's viewport, so they follow zoom and pan).
// It listens to awareness itself, so a moving cursor never re-renders the canvas or the editor.
export function RemoteCursorsComponent({ awareness, members }: { awareness: Awareness; members: PresenceMember[] }) {
  const [cursors, setCursors] = useState(() => cursorsOf(awareness, members));

  useEffect(() => {
    const read = () => setCursors(cursorsOf(awareness, members));
    read();
    awareness.on('change', read);
    return () => awareness.off('change', read);
  }, [awareness, members]);

  return cursors.map(({ clientId, name, at }) => (
    <div
      key={clientId}
      role="img"
      aria-label={name}
      className="pointer-events-none absolute top-0 left-0 z-50"
      style={{ transform: `translate(${at.x}px, ${at.y}px)` }}
    >
      <MousePointer2 className="size-4 fill-foreground text-foreground" aria-hidden />
      <span className="ml-3 rounded-md bg-popover px-1.5 py-0.5 text-[11px] whitespace-nowrap text-foreground shadow">{name}</span>
    </div>
  ));
}
