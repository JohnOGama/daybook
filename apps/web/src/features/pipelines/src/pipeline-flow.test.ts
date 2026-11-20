import { expect, it } from 'vitest';
import { buildFlow } from './pipeline-flow';
import type { PipelineJob } from './pipelines-types';

const iso = (ms: number) => new Date(Date.now() - ms).toISOString();
const job = (name: string): PipelineJob => ({
  job: name,
  expected: ['Build', 'Deploy'],
  latest: {
    id: `${name}-run`,
    job: name,
    number: 1,
    status: 'running',
    url: null,
    branch: null,
    commit: null,
    startedAt: iso(5000),
    updatedAt: iso(1000),
    finishedAt: null,
    finishReason: null,
    stages: [{ name: 'Build', position: 0, status: 'passed', message: null, error: null, startedAt: iso(5000), finishedAt: iso(2000) }],
  },
});

it('lays each job out as a row: the job, its reported stages, then the ones still expected, joined in a chain', () => {
  const { nodes, edges } = buildFlow([job('api'), job('web')], new Date());
  expect(nodes.map((node) => node.id)).toEqual(['api', 'api::Build', 'api::Deploy', 'web', 'web::Build', 'web::Deploy']);
  expect(nodes[3].position.y).toBeGreaterThan(nodes[0].position.y);
  expect(nodes[2].position.x).toBeGreaterThan(nodes[1].position.x);
  expect(edges.filter((edge) => edge.source.startsWith('api')).map((edge) => edge.target)).toEqual(['api::Build', 'api::Deploy']);
  expect(nodes.every((node) => node.data.runId.endsWith('-run'))).toBe(true);
});
