'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchRun } from '../src/pipelines-api';
import type { PipelineRun } from '../src/pipelines-types';

// One run for the drawer, read only while it is open; it starts from the copy the page already has.
export function usePipelineRun(runId: string | null, initial?: PipelineRun) {
  return useQuery({ queryKey: ['pipeline-run', runId], queryFn: () => fetchRun(runId as string), enabled: Boolean(runId), placeholderData: initial });
}
