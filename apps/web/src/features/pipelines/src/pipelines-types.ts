// Mirrors the API's PipelinesView and RunView (apps/api/src/features/pipelines/src/pipelines-service.ts).
export type StageStatus = 'running' | 'passed' | 'failed' | 'skipped';
export type RunStatus = 'running' | 'passed' | 'failed';
export type ShownStatus = RunStatus | 'stopped';

export type PipelineStage = { name: string; position: number; status: StageStatus; message: string | null; error: string | null; startedAt: string; finishedAt: string | null };

export type PipelineRun = {
  id: string;
  job: string;
  number: number;
  status: RunStatus;
  url: string | null;
  branch: string | null;
  commit: string | null;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  finishReason: 'aborted' | null;
  stages: PipelineStage[];
};

export type PipelineJob = { job: string; latest: PipelineRun; expected: string[] };
export type PipelinesView = { jobs: PipelineJob[]; recent: PipelineRun[] };

export const STATUS_LABELS: Record<ShownStatus, string> = { running: 'Running', passed: 'Passed', failed: 'Failed', stopped: 'Stopped reporting' };
