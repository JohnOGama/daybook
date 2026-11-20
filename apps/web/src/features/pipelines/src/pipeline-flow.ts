import type { Edge, Node } from '@xyflow/react';
import { formatDuration, latestMessage, pendingStages, safeLink, shownStatus, stageDuration, timeAgo } from './pipeline-math';
import type { PipelineJob, ShownStatus, StageStatus } from './pipelines-types';

export const JOB_WIDTH = 288;
export const JOB_HEIGHT = 148;
export const STAGE_WIDTH = 176;
export const STAGE_HEIGHT = 76;
const STAGE_GAP = 72;
const ROW_GAP = 190;

export type JobNodeData = {
  runId: string;
  job: string;
  status: ShownStatus;
  meta: string;
  link: string | null;
  aborted: boolean;
  message: { stage: string; text: string; ago: string } | null;
};
export type StageNodeData = { runId: string; name: string; icon: StageStatus | 'pending'; detail: string; running: boolean };
export type JobNode = Node<JobNodeData, 'job'>;
export type StageNode = Node<StageNodeData, 'stage'>;
export type PipelineNode = JobNode | StageNode;

const STROKE: Record<StageStatus | 'pending', string> = {
  passed: 'var(--status-done)',
  failed: 'var(--destructive)',
  running: 'var(--status-progress)',
  skipped: 'var(--border)',
  pending: 'var(--border)',
};

// Each job becomes a row: a job node, then one node per stage (reported first, then the ones still expected), joined by connectors.
export function buildFlow(jobs: PipelineJob[], now: Date): { nodes: PipelineNode[]; edges: Edge[] } {
  const nodes: PipelineNode[] = [];
  const edges: Edge[] = [];

  jobs.forEach(({ job, latest: run, expected }, row) => {
    const status = shownStatus(run, now);
    const message = latestMessage(run);
    const y = row * ROW_GAP;
    const meta = [`#${run.number}`, run.branch, run.commit?.slice(0, 7), status === 'running' || status === 'stopped' ? `started ${timeAgo(run.startedAt, now)}` : `finished ${timeAgo(run.finishedAt ?? run.updatedAt, now)}`]
      .filter(Boolean)
      .join(' · ');
    nodes.push({
      id: job,
      type: 'job',
      position: { x: 0, y },
      width: JOB_WIDTH,
      height: JOB_HEIGHT,
      data: {
        runId: run.id,
        job,
        status,
        meta,
        link: safeLink(run.url),
        aborted: run.finishReason === 'aborted',
        message: message && { stage: message.stage, text: message.message, ago: timeAgo(message.at, now) },
      },
    });

    const steps: { name: string; icon: StageStatus | 'pending'; detail: string }[] = [
      ...run.stages.map((stage) => ({
        name: stage.name,
        icon: stage.status,
        detail: stage.status === 'running' ? `Running · ${formatDuration(stageDuration(stage, now))}` : stage.status === 'skipped' ? 'Skipped' : formatDuration(stageDuration(stage, now)),
      })),
      ...pendingStages(run, expected).map((name) => ({
        name,
        icon: run.status === 'running' ? ('pending' as const) : ('skipped' as const),
        detail: run.status === 'running' ? 'Waiting' : 'Skipped',
      })),
    ];

    let previous = job;
    steps.forEach((step, index) => {
      const id = `${job}::${step.name}`;
      nodes.push({
        id,
        type: 'stage',
        position: { x: JOB_WIDTH + STAGE_GAP + index * (STAGE_WIDTH + STAGE_GAP), y: y + (JOB_HEIGHT - STAGE_HEIGHT) / 2 },
        width: STAGE_WIDTH,
        height: STAGE_HEIGHT,
        data: { runId: run.id, name: step.name, icon: step.icon, detail: step.detail, running: step.icon === 'running' },
      });
      edges.push({
        id: `${previous}->${id}`,
        source: previous,
        target: id,
        animated: step.icon === 'running',
        style: { stroke: STROKE[step.icon], strokeWidth: 2, strokeDasharray: step.icon === 'pending' ? '4 4' : undefined },
      });
      previous = id;
    });
  });

  return { nodes, edges };
}
