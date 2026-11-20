# Skills tool design

## Why

The owner writes Claude Code skills (`SKILL.md`) and wants one place to write them, have an AI improve them over several rounds, and save them as `.md` files. The approved mockup is two screens: a skill list with an editor, and an Improve panel beside it.

## Goals

- A Skills space lists skills, newest first, reorderable. Each skill has a name, a description (when Claude should use it) and a markdown body, autosaved.
- Plain hints for a name or description Claude would struggle with.
- Improve with AI: explains what the skill is for, lists what changed, shows a line-by-line comparison, and lets the owner improve more (free text or quick asks) for as many rounds as they like, going back to any round. "Use this version" applies it, with Undo.
- Download `SKILL.md`, copy it, and a `SKILL.md` tab that shows the exact file.
- Upload a skill folder (or a whole `.claude/skills` folder): each SKILL.md becomes a skill, keeping its other frontmatter keys and its other text files (such as `templates/`). A skill with files downloads as `<name>.zip` holding its folder, and its files are listed in a Files tab.

## Non-goals

- No rendered markdown preview (no markdown library in the app); the SKILL.md tab shows the raw file.
- No editing a skill's other files in place, no binary files, no writing into `.claude/skills/` on disk.
- No history panel for skills yet; history copies are kept on the server as for Notebook pages.

## Approaches

1. **Reuse `notebook_pages` (picked).** A skill is a page whose title is the name and whose content is `{ type: 'skill', description, body }`. Autosave, conflicts, sharing, Trash, duplicate and history copies come for free. Costs one content check in `NotebookService.update`.
2. **A new `skills` table and service.** Cleaner columns but repeats autosave, versions, sharing checks, Trash and duplicate for no gain.
3. **Store the whole SKILL.md as one string.** Simplest storage, but the editor would have to parse frontmatter on every keystroke.

## How

- API: `skills` added to `space_tool` (migration `0025_skills`), `PAGE_TOOLS` and the create schema. The page content schema accepts a doc or a skill; `update` refuses the wrong kind for the space. `POST /notebook-pages/ai/skill` (edit access) calls `BudgetAiService.improveSkill`, which asks Gemini for name, description, body lines, purpose and changes, and keeps the old name if the new one breaks the naming rules.
- Web: `features/skills` (`SkillsPageComponent`, `SkillEditorComponent`, `SkillImprovePanelComponent`, `skill-md.ts`, `skills-api.ts`) on `/skills`, reusing `usePages`, `usePageMutations`, `usePageAutosave`, `PageListComponent` (now with `itemName` and `snippetOf`) and `diffLines` from Notebook.
- Rules are kept in `docs/claude/skills.md`.
