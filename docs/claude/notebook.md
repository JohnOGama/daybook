# Page history

## Page history

- Saving new content to a Notebook page or Book chapter first copies the old content into `notebook_page_versions`, at most once every ten minutes per page and 50 copies per page (`keepVersion` in `notebook-service.ts`). `POST /notebook-pages/:id/versions` forces a copy, which restore does first so it can be undone.
- The history panel (`PageHistoryComponent`) compares a version with the editor's current content line by line in the browser (`page-diff.ts`); restoring replaces the editor content and lets autosave store it. Titles are not versioned.
