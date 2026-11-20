import { parseSkillMd, type SkillDraft } from './skill-md';

// A file from a picked folder: `text` is null when it isn't UTF-8 text or is too large to keep.
export type FolderEntry = { path: string; text: string | null };

const FILE_MAX_BYTES = 256_000;
// The server's limits for one skill's files.
const FILES_MAX_CHARS = 500_000;
const FILES_MAX = 100;
const PATH_MAX = 200;
const IGNORED_NAMES = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
const IGNORED_FOLDERS = new Set(['.git', 'node_modules']);

export async function readFolder(files: File[]): Promise<FolderEntry[]> {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  return Promise.all(
    files.map(async (file) => {
      const path = file.webkitRelativePath || file.name;
      if (file.size > FILE_MAX_BYTES) return { path, text: null };
      try {
        const text = decoder.decode(await file.arrayBuffer());
        return { path, text: text.includes('\0') ? null : text };
      } catch {
        return { path, text: null };
      }
    }),
  );
}

const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);
const isSkillMd = (path: string) => path.slice(path.lastIndexOf('/') + 1).toLowerCase() === 'skill.md';

// Every folder holding a SKILL.md is one skill, so picking .claude/skills brings in all of them at once.
// Each other file belongs to the deepest skill folder it is in; files outside every skill folder are left out.
export function skillsFromFolder(entries: FolderEntry[]): { skills: SkillDraft[]; skipped: string[] } {
  const kept = entries.filter(({ path }) => {
    const parts = path.split('/');
    return !IGNORED_NAMES.has(parts[parts.length - 1]) && !parts.some((part) => IGNORED_FOLDERS.has(part));
  });
  const roots = kept.filter(({ path, text }) => isSkillMd(path) && text !== null).map(({ path }) => dirOf(path));
  const skipped: string[] = kept.filter(({ path, text }) => isSkillMd(path) && text === null).map(({ path }) => path);

  const skills = roots.map((root) => {
    const parsed = parseSkillMd(kept.find(({ path }) => isSkillMd(path) && dirOf(path) === root)?.text ?? '');
    const files: SkillDraft['files'] = [];
    let size = 0;
    for (const { path, text } of kept) {
      // Every readable SKILL.md is a skill of its own, never another skill's file.
      if (isSkillMd(path)) continue;
      const deepest = roots.filter((other) => path.startsWith(other)).sort((a, b) => b.length - a.length)[0];
      if (deepest !== root) continue;
      const inSkill = path.slice(root.length);
      if (text === null || size + text.length > FILES_MAX_CHARS || inSkill.length > PATH_MAX || files.length === FILES_MAX) {
        skipped.push(path);
        continue;
      }
      size += text.length;
      files.push({ path: inSkill, content: text });
    }
    return { ...parsed, name: parsed.name || (root.split('/').filter(Boolean).at(-1) ?? ''), files };
  });
  return { skills, skipped };
}
