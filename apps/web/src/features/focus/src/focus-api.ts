import type { FocusSession, FocusSettings, FocusView } from './focus-types';

const json = { 'Content-Type': 'application/json' };

export async function fetchFocus(spaceId: string, from: string, to: string): Promise<FocusView> {
  const response = await fetch(`/api/focus/${spaceId}?${new URLSearchParams({ from, to })}`);
  if (!response.ok) throw new Error('Could not load this focus space');
  return response.json();
}

export async function saveFocusSettings({ spaceId, settings }: { spaceId: string; settings: FocusSettings }): Promise<void> {
  const response = await fetch(`/api/focus/${spaceId}/settings`, { method: 'PUT', headers: json, body: JSON.stringify(settings) });
  if (!response.ok) throw new Error('Those timer lengths could not be saved. Please try again.');
}

export async function addFocusSession(spaceId: string, session: FocusSession): Promise<void> {
  const response = await fetch(`/api/focus/${spaceId}/sessions`, { method: 'POST', headers: json, body: JSON.stringify(session) });
  if (!response.ok) throw new Error('That focus session could not be saved.');
}
