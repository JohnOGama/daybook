# Skills rules

## Skills rules

- A Skills space keeps Claude Code skills. Each skill is a `notebook_pages` row: the title is the skill's `name`, and the content is `{ type: 'skill', description, body, frontmatter?, files? }` instead of a rich-text doc. `frontmatter` keeps any other SKILL.md keys (allowed-tools, model…) word for word. `files` holds the folder's other text files as `{ path, content }`, such as `templates/Jenkinsfile`. Pages, autosave (`usePageAutosave`), the `version` 409, sharing, Trash, duplicate and history copies all work as for Notebook. `NotebookService` refuses skill content outside a Skills space and doc content inside one, on create and on update.
- File limits are checked on the server (`notebook-schemas.ts`):
  - A file path is relative with forward slashes, has no `.`, `..` or empty parts, isn't `SKILL.md`, and is at most 200 characters. Paths are unique.
  - At most 100 files and 500,000 characters of files per skill, and a body of 200,000 characters.
  - The whole content goes with every content save, so keep these limits under the 2 MB JSON body limit in `main.ts`.
- **Upload folder** (`UploadFolderButtonComponent`, a `webkitdirectory` file input). `readFolder` reads each file as strict UTF-8 and marks binaries, files with NUL bytes and files over 256 KB as unreadable. `skillsFromFolder` then works out the skills:
  - Every folder with a readable SKILL.md is one skill, so picking `.claude/skills` brings in every skill in it.
  - Each other file belongs to the deepest skill folder it sits in. `.git`, `node_modules` and OS files are ignored.
  - Unreadable files, and files past the limits, are left out and named in the toast.
  - The name comes from the frontmatter, or the folder name if there is none.
  - Each skill is created in one request (`POST /notebook-pages` takes an optional `title` and `content`), so the editor never races a second save.
- `parseSkillMd` reads `name` and `description` as YAML values (plain, multi-line, quoted, or `|`/`>` blocks) and normalises CRLF and the BOM. `toSkillMd` writes `name` plain, `description` as a JSON string (valid YAML, so colons and quotes can't break it), then the kept frontmatter, then the body.
- The editor (`SkillEditorComponent`):
  - Has Name, Description, the body, a SKILL.md tab with the exact file, and a Files tab listing the other files. You can open a file to read it or remove it, with Undo. Files can't be edited in place.
  - Typing a name lowercases it and turns spaces into hyphens (`toSkillName`).
  - `skillHints` flags a name that breaks the rules (lowercase letters, digits, single hyphens, at most 64 characters) and a missing, short (under 40) or long (over 1024) description. These are hints only.
  - Download saves `SKILL.md`, or `<name>.zip` holding the `<name>/` folder when the skill has other files. The zip comes from `zip.ts`, a small writer that stores files without compressing them. Copy copies SKILL.md only.
- Improve (`POST /notebook-pages/ai/skill`, `BudgetAiService.improveSkill`, edit access needed) is sent only that skill's name, description and body, the paths of its other files (never their contents) and an optional instruction. It returns name, description and body, a `purpose` (what the skill is for) and up to five `changes`. The body comes back as a list of lines, which the server joins, and a name that breaks the rules keeps the old one. Nothing is saved by the route.
- The Improve panel (`SkillImprovePanelComponent`) starts a round when it opens. "Improve more" and the quick asks build on the round on screen, and earlier rounds stay selectable. Every round is compared line by line (`diffLines`) with the editor's current SKILL.md. "Use this version" replaces only name, description and body (frontmatter and files stay), and Undo in the toast puts back what was there.
