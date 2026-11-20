'use client';

import dynamic from 'next/dynamic';
import { SkeletonBox } from 'skullet/react';

// React Flow only loads on this page, and only in the browser.
export const PipelineCanvas = dynamic(() => import('./PipelineCanvasComponent').then((module) => module.PipelineCanvasComponent), {
  ssr: false,
  loading: () => <SkeletonBox width="100%" height="100%" />,
});
