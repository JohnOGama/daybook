import { throwIfConflict } from '@/shared/utils/conflict-error';
import type { Positions } from './diagram-types';

export type Diagram = { dbml: string; positions: Positions; updatedAt: string | null; aiEnabled: boolean; version: number };

async function request(method: string, path: string, body: unknown, failure: string): Promise<Response> {
  const response = await fetch(`/api/diagrams${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  throwIfConflict(response);
  if (!response.ok) {
    const reason = await response.json().catch(() => null);
    throw new Error([400, 429, 502, 503].includes(response.status) && typeof reason?.message === 'string' ? reason.message : failure);
  }
  return response;
}

export async function fetchDiagram(spaceId: string): Promise<Diagram> {
  return (await request('GET', `?${new URLSearchParams({ spaceId })}`, undefined, 'Could not load this diagram')).json();
}

export async function saveDiagram(input: { spaceId: string; dbml: string; positions: Positions; version: number }): Promise<{ version: number }> {
  return (await request('PUT', '', input, 'The diagram could not be saved. Please try again.')).json();
}

export async function editWithAi(input: { spaceId: string; dbml: string; prompt: string }): Promise<{ dbml: string; summary: string }> {
  return (await request('POST', '/ai/edit', input, 'The AI could not change the diagram. Please try again.')).json();
}
