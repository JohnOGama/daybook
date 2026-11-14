'use client';

import dynamic from 'next/dynamic';
import { memo } from 'react';
import { SkeletonBox } from 'skullet/react';

// React Flow, CodeMirror and html-to-image only load on the diagram page, and only in the browser.
// Memoised: typing in the code panel re-renders the page, but the canvas only needs to redraw when its props change.
export const DiagramCanvas = memo(
  dynamic(() => import('./DiagramCanvasComponent').then((module) => module.DiagramCanvasComponent), {
    ssr: false,
    loading: () => <SkeletonBox width="100%" height="100%" />,
  }),
);

export const DbmlEditor = dynamic(() => import('./DbmlEditorComponent').then((module) => module.DbmlEditorComponent), {
  ssr: false,
  loading: () => <SkeletonBox width="100%" height="100%" />,
});
