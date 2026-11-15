import { cn } from '@/shared/utils/cn';
import type { PipelineStatus, Space } from './space-types';

const LABEL: Record<PipelineStatus, string> = { passed: 'the last run passed', running: 'a stage is running', failed: 'the last run failed' };
const TONE: Record<PipelineStatus, string> = {
  passed: 'bg-status-done',
  running: 'bg-status-progress motion-safe:animate-pulse',
  failed: 'bg-destructive',
};

// The live status of a Pipelines space at the end of its sidebar row; it changes the moment Jenkins reports.
export function PipelineDotComponent({ space }: { space: Space }) {
  if (space.tool !== 'pipelines' || !space.pipelines) return null;
  return <span role="img" aria-label={`${space.title}, ${LABEL[space.pipelines]}`} className={cn('ml-auto size-2 shrink-0 rounded-full', TONE[space.pipelines])} />;
}
