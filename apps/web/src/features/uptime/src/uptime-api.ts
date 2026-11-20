import type { MonitorChanges, MonitorDetail, MonitorInput, MonitorRow, UptimeView } from './uptime-types';

const json = { 'Content-Type': 'application/json' };

// 400 and 429 carry a message written for people ("Public addresses only"); anything else gets a plain sentence.
async function readOrThrow<T>(response: Response, fallback: string): Promise<T> {
  if (response.ok) return response.status === 204 ? (undefined as T) : response.json();
  if (response.status === 400 || response.status === 429) {
    const body = await response.json().catch(() => null);
    if (typeof body?.message === 'string') throw new Error(body.message);
  }
  throw new Error(fallback);
}

export async function fetchUptime(spaceId: string): Promise<UptimeView> {
  return readOrThrow(await fetch(`/api/uptime/${spaceId}`), 'Could not load these sites');
}

export async function fetchMonitor(id: string): Promise<MonitorDetail> {
  return readOrThrow(await fetch(`/api/uptime/monitors/${id}`), 'Could not load this site');
}

export async function addMonitor(spaceId: string, input: MonitorInput): Promise<MonitorRow> {
  const response = await fetch(`/api/uptime/${spaceId}/monitors`, { method: 'POST', headers: json, body: JSON.stringify(input) });
  return readOrThrow(response, 'That site could not be added. Please try again.');
}

export async function updateMonitor(id: string, changes: MonitorChanges): Promise<MonitorRow> {
  const response = await fetch(`/api/uptime/monitors/${id}`, { method: 'PATCH', headers: json, body: JSON.stringify(changes) });
  return readOrThrow(response, 'That change could not be saved. Please try again.');
}

export async function checkMonitor(id: string): Promise<MonitorRow> {
  return readOrThrow(await fetch(`/api/uptime/monitors/${id}/check`, { method: 'POST' }), 'That site could not be checked. Please try again.');
}

export async function deleteMonitor(id: string): Promise<void> {
  const response = await fetch(`/api/uptime/monitors/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('That site could not be deleted. Please try again.');
}
