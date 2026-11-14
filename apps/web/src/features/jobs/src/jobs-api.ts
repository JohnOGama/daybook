import type { Job, JobFields, Jobs, Match, ReadPostingResult } from './jobs-types';

async function request(method: string, path: string, body: unknown, failure: string): Promise<Response> {
  const response = await fetch(`/api/jobs${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const reason = await response.json().catch(() => null);
    throw new Error(response.status === 400 && typeof reason?.message === 'string' ? reason.message : failure);
  }
  return response;
}

export async function fetchJobs(spaceId: string): Promise<Jobs> {
  return (await request('GET', `?${new URLSearchParams({ spaceId })}`, undefined, 'Could not load this job hunt')).json();
}

export async function saveCv(input: { spaceId: string; cvText: string | null }): Promise<void> {
  await request('PUT', '/profile', input, 'Your CV could not be saved. Please try again.');
}

export async function createJob({ spaceId, job }: { spaceId: string; job: Job }): Promise<void> {
  const { updatedAt: _updatedAt, ...fields } = job;
  await request('POST', '', { ...fields, spaceId }, 'The job could not be added. Please try again.');
}

export async function updateJob({ id, changes }: { id: string; changes: Partial<JobFields> }): Promise<void> {
  await request('PATCH', `/${id}`, changes, 'The job could not be saved. Please try again.');
}

export async function deleteJob(id: string): Promise<void> {
  await request('DELETE', `/${id}`, undefined, 'The job could not be deleted. Please try again.');
}

export async function readPosting(input: { spaceId: string; url: string }): Promise<ReadPostingResult> {
  return (await request('POST', '/ai/read-posting', input, 'Could not read that posting. Please try again.')).json();
}

export async function matchJob(id: string): Promise<Match> {
  return (await request('POST', `/${id}/match`, undefined, 'Could not check the match. Please try again.')).json();
}
