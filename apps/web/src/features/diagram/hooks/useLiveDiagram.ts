'use client';

import { useCallback, useEffect, useState } from 'react';
import * as Y from 'yjs';
import type { SpacePresence } from '@/features/spaces';
import type { Point, Positions } from '../src/diagram-types';

export type LiveChange = { undo(): void; release(): void };

// Writes only the tables whose position changed, and forgets tables that are gone.
export function writePositions(map: Y.Map<Point>, next: Positions): void {
  for (const [name, point] of Object.entries(next)) {
    const current = map.get(name);
    if (!current || current.x !== point.x || current.y !== point.y) map.set(name, point);
  }
  for (const name of [...map.keys()]) if (!(name in next)) map.delete(name);
}

// The diagram's shared Yjs document: `dbml` text and `positions`, kept in step with everyone in the space.
export function useLiveDiagram({ doc }: SpacePresence) {
  const ytext = doc.getText('dbml');
  const ymap = doc.getMap<Point>('positions');
  const [text, setText] = useState(() => ytext.toString());
  const [positions, setPositionsState] = useState<Positions>(() => ymap.toJSON() as Positions);

  useEffect(() => {
    const readText = () => setText(ytext.toString());
    const readPositions = () => setPositionsState(ymap.toJSON() as Positions);
    ytext.observe(readText);
    ymap.observe(readPositions);
    readText();
    readPositions();
    return () => {
      ytext.unobserve(readText);
      ymap.unobserve(readPositions);
    };
  }, [ytext, ymap]);

  const setPositions = useCallback((next: Positions) => doc.transact(() => writePositions(ymap, next)), [doc, ymap]);
  const move = useCallback((table: string, point: Point) => ymap.set(table, point), [ymap]);

  // One change (AI, import, tidy) whose Undo reverses only that change, keeping everyone's edits since.
  const change = useCallback(
    (apply: () => void): LiveChange => {
      const origin = {};
      const undoManager = new Y.UndoManager([ytext, ymap], { trackedOrigins: new Set([origin]), captureTimeout: 0 });
      doc.transact(apply, origin);
      return {
        undo: () => {
          undoManager.undo();
          undoManager.destroy();
        },
        release: () => undoManager.destroy(),
      };
    },
    [doc, ytext, ymap],
  );

  return { text, positions, ytext, ymap, setPositions, move, change };
}
