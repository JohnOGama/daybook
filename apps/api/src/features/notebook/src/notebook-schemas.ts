import { z } from 'zod';

const title = z.string().trim().max(200);
const skillName = z.string().trim().max(64);
const skillDescription = z.string().max(1024);
const skillBody = z.string().max(200_000);
const FILES_MAX_CHARS = 500_000;
// A path inside the skill's folder, like templates/Jenkinsfile: relative, forward slashes, never leaving the folder.
const skillFilePath = z
  .string()
  .max(200)
  .refine((path) => path !== 'SKILL.md' && !path.includes('\\') && path.split('/').every((part) => part !== '' && part !== '.' && part !== '..'), 'Not a path inside the skill');
const skillFiles = z
  .array(z.object({ path: skillFilePath, content: z.string() }))
  .max(100)
  .refine((files) => new Set(files.map(({ path }) => path)).size === files.length, 'Each file path can appear only once')
  .refine((files) => files.reduce((total, { content: text }) => total + text.length, 0) <= FILES_MAX_CHARS, 'The skill\'s files are too large');
// A Skills space's page holds its skill instead of a rich-text document; the page title is the skill's name.
// `frontmatter` keeps any other SKILL.md keys (allowed-tools, model…) word for word; `files` are the folder's other text files.
export const skillContentSchema = z.object({
  type: z.literal('skill'),
  description: skillDescription,
  body: skillBody,
  frontmatter: z.string().max(5_000).optional(),
  files: skillFiles.optional(),
});
const content = z.union([z.looseObject({ type: z.literal('doc'), content: z.array(z.unknown()).optional() }), skillContentSchema]);
const version = z.number().int().min(0);

export const listPagesSchema = z.object({ spaceId: z.uuid() });
// An uploaded skill arrives with its title and content, so it is saved in one go.
export const createPageSchema = z.object({ id: z.uuid(), spaceId: z.uuid(), title: title.optional(), content: content.optional() });
// Content needs the version it was edited from, so a stale save can be refused; a rename alone never conflicts.
export const updatePageSchema = z
  .object({ title: title.optional(), content: content.optional(), version: version.optional() })
  .refine((page) => page.content === undefined || page.version !== undefined, { message: 'Send the version you edited', path: ['version'] });
export const improveTextSchema = z.object({ spaceId: z.uuid(), text: z.string().trim().min(1).max(8000), instruction: z.string().trim().min(1).max(300) });
export const improveSkillSchema = z.object({
  spaceId: z.uuid(),
  // Only the paths of the skill's other files are sent, so the AI keeps references to them.
  skill: z.object({ name: skillName, description: skillDescription, body: skillBody, files: z.array(skillFilePath).max(100).optional() }),
  instruction: z.string().trim().max(300).optional(),
});
export const reorderPagesSchema = z.object({ spaceId: z.uuid(), ids: z.array(z.uuid()).min(1).max(1000) });
