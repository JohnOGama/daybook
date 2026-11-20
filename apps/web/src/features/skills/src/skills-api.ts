import type { ImprovedSkill, SkillDraft } from './skill-md';

// Only the paths of the skill's other files are sent, never their contents.
type SkillToImprove = Pick<SkillDraft, 'name' | 'description' | 'body'> & { files?: string[] };

export async function improveSkill(input: { spaceId: string; skill: SkillToImprove; instruction?: string }): Promise<ImprovedSkill> {
  const response = await fetch('/api/notebook-pages/ai/skill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (response.status === 503) throw new Error('AI features are off on this server.');
  if (response.status === 429) throw new Error('The AI service is busy. Please try again in a minute.');
  if (!response.ok) throw new Error("The AI couldn't improve this skill just now. Please try again.");
  return response.json();
}
