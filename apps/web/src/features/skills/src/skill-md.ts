import type { NotebookPage } from '@/features/notebook';
import { zipFiles } from './zip';

export type SkillFile = { path: string; content: string };
// `frontmatter` is any other SKILL.md keys (allowed-tools, model…), kept word for word; `files` are the folder's other files.
export type SkillDraft = { name: string; description: string; body: string; frontmatter: string; files: SkillFile[] };
export type SkillText = Pick<SkillDraft, 'name' | 'description' | 'body'> & { frontmatter?: string };
export type ImprovedSkill = Pick<SkillDraft, 'name' | 'description' | 'body'> & { purpose: string; changes: string[] };
export type SkillHints = Partial<Record<'name' | 'description', string>>;

const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX = 64;
export const DESCRIPTION_MAX = 1024;
const DESCRIPTION_MIN = 40;

// A skill is a page: its title is the name, its content holds everything else.
export function skillOf({ title, content }: Pick<NotebookPage, 'title' | 'content'>): SkillDraft {
  const skill = content?.type === 'skill' ? content : undefined;
  return {
    name: title,
    description: String(skill?.description ?? ''),
    body: String(skill?.body ?? ''),
    frontmatter: String(skill?.frontmatter ?? ''),
    files: Array.isArray(skill?.files) ? skill.files : [],
  };
}

export const skillContent = ({ description, body, frontmatter, files }: SkillDraft) => ({ type: 'skill', description, body, frontmatter, files });

// Typing "Deploy Checklist" gives "deploy-checklist"; anything else that breaks the rules is left for a hint.
export const toSkillName = (value: string) => value.toLowerCase().replace(/[\s_]+/g, '-');

export function skillHints({ name, description }: Pick<SkillDraft, 'name' | 'description'>): SkillHints {
  const hints: SkillHints = {};
  if (!name) hints.name = 'Give it a name. It becomes the folder name in .claude/skills/.';
  else if (name.length > NAME_MAX || !SKILL_NAME.test(name)) hints.name = 'Use lowercase letters, numbers and single hyphens, up to 64 characters.';
  const text = description.trim();
  if (!text) hints.description = 'Say when Claude should use it. Claude reads only this to decide.';
  else if (text.length > DESCRIPTION_MAX) hints.description = `Keep it under ${DESCRIPTION_MAX} characters (now ${text.length}).`;
  else if (text.length < DESCRIPTION_MIN) hints.description = 'Too short to trigger reliably. Say when to use it, e.g. "Use when…".';
  return hints;
}

// The description is written as a JSON string, which is also a valid YAML string, so colons and quotes can't break it.
export function toSkillMd({ name, description, body, frontmatter }: SkillText): string {
  const lines = ['---', `name: ${name || 'untitled-skill'}`, `description: ${JSON.stringify(description.replace(/\s+/g, ' ').trim())}`];
  if (frontmatter?.trim()) lines.push(frontmatter.trim());
  lines.push('---');
  return body.trim() ? `${lines.join('\n')}\n\n${body.trim()}\n` : `${lines.join('\n')}\n`;
}

// Reads one YAML value: plain (possibly over several lines), "double" or 'single' quoted, or a | or > block.
function yamlValue(first: string, more: string[]): string {
  const rest = more.map((line) => line.trim()).filter(Boolean);
  if (/^[|>][-+]?$/.test(first)) return rest.join(first.startsWith('|') ? '\n' : ' ');
  const value = [first, ...rest].join(' ').trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'");
  return value;
}

export function parseSkillMd(text: string): Omit<SkillDraft, 'files'> {
  const source = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(source);
  if (!match) return { name: '', description: '', body: source.trim(), frontmatter: '' };
  // Each top-level key starts an entry; indented lines after it belong to it.
  const entries: string[][] = [];
  for (const line of match[1].split('\n')) {
    if (entries.length === 0 || /^[A-Za-z][\w-]*\s*:/.test(line)) entries.push([line]);
    else entries[entries.length - 1].push(line);
  }
  let name = '';
  let description = '';
  const other: string[] = [];
  for (const [first, ...more] of entries) {
    const [, key, value = ''] = /^([\w-]+)\s*:\s*(.*)$/.exec(first) ?? [];
    if (key === 'name') name = yamlValue(value.trim(), more);
    else if (key === 'description') description = yamlValue(value.trim(), more);
    else other.push(first, ...more);
  }
  return { name, description, body: source.slice(match[0].length).trim(), frontmatter: other.join('\n').trim() };
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// A skill with other files downloads as its folder, zipped; one without is just SKILL.md.
export function downloadSkill(skill: SkillDraft) {
  if (skill.files.length === 0) return save(new Blob([toSkillMd(skill)], { type: 'text/markdown' }), 'SKILL.md');
  const folder = skill.name || 'untitled-skill';
  const zip = zipFiles([
    { path: `${folder}/SKILL.md`, text: toSkillMd(skill) },
    ...skill.files.map(({ path, content }) => ({ path: `${folder}/${path}`, text: content })),
  ]);
  save(new Blob([zip], { type: 'application/zip' }), `${folder}.zip`);
}
