import type { PipelineRun, PipelinesView } from './pipelines-types';

async function request<T>(method: string, path: string, body: unknown, failure: string): Promise<T> {
  const response = await fetch(`/api/pipelines${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const reason = await response.json().catch(() => null);
    throw new Error([400, 429, 502, 503].includes(response.status) && typeof reason?.message === 'string' ? reason.message : failure);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const fetchPipelines = (spaceId: string) => request<PipelinesView>('GET', `?${new URLSearchParams({ spaceId })}`, undefined, 'Could not load these pipelines');

export const fetchRun = (runId: string) => request<PipelineRun>('GET', `/runs/${runId}`, undefined, 'Could not load this run');

export type KeyStatus = { createdAt: string; lastUsedAt: string | null } | null;

export const fetchKeyStatus = (spaceId: string) => request<KeyStatus>('GET', `/${spaceId}/key`, undefined, 'Could not load the key');

export const createKey = (spaceId: string) => request<{ key: string }>('POST', `/${spaceId}/key`, undefined, 'Could not make a key. Please try again.');

export const instrumentJenkinsfile = (input: { spaceId: string; jenkinsfile: string }) =>
  request<{ jenkinsfile: string; summary: string }>('POST', '/ai/instrument', input, 'The AI could not add reporting. Please try again.');
