import type { PipelineRun, PipelinesView } from './pipelines-types';

// Shape-only data drawn behind the loading skeleton.
export function samplePipelines(now: Date): PipelinesView {
  const at = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const stage = (name: string, position: number, status: PipelineRun['stages'][number]['status']) => ({
    name,
    position,
    status,
    message: null,
    error: null,
    startedAt: at(150_000 - position * 30_000),
    finishedAt: status === 'running' ? null : at(120_000 - position * 30_000),
  });
  const run = (id: string, job: string, status: PipelineRun['status']): PipelineRun => ({
    id,
    job,
    number: 1,
    status,
    url: null,
    branch: 'main',
    commit: '0000000',
    startedAt: at(150_000),
    updatedAt: at(5_000),
    finishedAt: status === 'running' ? null : at(5_000),
    finishReason: null,
    stages: [stage('Checkout', 0, 'passed'), stage('Build', 1, 'passed'), stage('Test', 2, status === 'running' ? 'running' : 'passed')],
  });
  const runs = [run('sample-1', 'deploy', 'running'), run('sample-2', 'nightly', 'passed')];
  return { jobs: runs.map((latest) => ({ job: latest.job, latest, expected: [] })), recent: runs };
}
