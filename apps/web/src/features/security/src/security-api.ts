import type { FindingChanges, FindingInput, FindingRow, ScanResult, SecurityView } from './security-types';

const json = { 'Content-Type': 'application/json' };

async function readOrThrow<T>(response: Response, fallback: string): Promise<T> {
  if (response.ok) return response.status === 204 ? (undefined as T) : response.json();
  if (response.status === 400 || response.status === 429) {
    const body = await response.json().catch(() => null);
    if (typeof body?.message === 'string') throw new Error(body.message);
  }
  throw new Error(fallback);
}

export async function fetchSecurity(spaceId: string): Promise<SecurityView> {
  return readOrThrow(await fetch(`/api/security/${spaceId}`), 'Could not load these findings');
}

export async function addFinding(spaceId: string, input: FindingInput): Promise<FindingRow> {
  const response = await fetch(`/api/security/${spaceId}/findings`, { method: 'POST', headers: json, body: JSON.stringify(input) });
  return readOrThrow(response, 'That finding could not be added. Please try again.');
}

export async function updateFinding(id: string, changes: FindingChanges): Promise<FindingRow> {
  const response = await fetch(`/api/security/findings/${id}`, { method: 'PATCH', headers: json, body: JSON.stringify(changes) });
  return readOrThrow(response, 'That change could not be saved. Please try again.');
}

export async function scanTarget(spaceId: string, url: string): Promise<ScanResult> {
  const response = await fetch(`/api/security/${spaceId}/scan`, { method: 'POST', headers: json, body: JSON.stringify({ url, authorized: true }) });
  return readOrThrow(response, 'That scan could not be run. Please try again.');
}

export async function deleteFinding(id: string): Promise<void> {
  const response = await fetch(`/api/security/findings/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('That finding could not be deleted. Please try again.');
}
