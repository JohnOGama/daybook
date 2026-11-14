# Database diagram design

Date: 2026-11-14

Items marked **(my call)** were chosen by Claude, not the owner, and can be overruled. The owner approved the layout in the mockup at `.superpowers/brainstorm/2353-1794618076/content/erd.html` (not committed; the sketch below records it) and chose the "code and diagram side by side" approach.

## What it is

Database diagram is an eighth tool for a space, beside List, Notebook, Book, Vault, Budget, Fitness and Job hunt. It draws an entity-relationship diagram (ERD), the way Eraser does: the diagram is written as text in DBML on the left and drawn on a pannable, zoomable canvas on the right. The owner can describe what they want in plain words and the AI writes or changes the diagram. It is for planning a database before building it and for documenting one that exists, so it reads existing schemas in and writes formats other tools accept.

## Goals

- Create a diagram from a prompt ("an online shop with users, products and orders") or change one ("add reviews linked to products and users").
- Edit the diagram as DBML text, with the canvas following as you type and mistakes shown on their line.
- Move around a large diagram: drag to pan, scroll or pinch to zoom, fit everything in view, an overview map.
- Drag tables to arrange them; the arrangement is remembered.
- Import an existing schema as DBML or as SQL `CREATE TABLE` statements.
- Export to DBML, Mermaid, SQL (PostgreSQL, MySQL, SQL Server), PNG and SVG.

## Non-goals (for now)

All **(my call)**:

- Connecting to a live database to read its schema. Paste its SQL instead.
- Editing tables through forms on the canvas. Changes go through the text or the prompt.
- Diagrams other than ERDs (flowcharts, sequence diagrams).
- Several diagrams in one space. One space holds one diagram; use several spaces, perhaps in a folder.
- Drawing DBML `TableGroup`s, notes and indexes on the canvas. They stay in the text and in exports.
- Sharing links, comments, or several people editing at once.
- Working offline.

## Anti-goals

- An AI change that silently breaks the diagram. A reply that does not parse is refused and the diagram stays as it was.
- An AI change that cannot be undone in one step.
- Exports that other tools reject. Every code export comes from a real parser and converter, not hand-built strings, except Mermaid (see below), which is tested.
- Anything beyond the current diagram text and the prompt sent to the AI.
- One person seeing or changing another person's diagram.

## Approaches

1. **Code and diagram side by side (chosen).** DBML text is the source of truth; the canvas is drawn from it; the AI edits the text; every export is generated from it. Matches Eraser, makes AI changes reliable and undoable, and gives exports for free through `@dbml/core`. Cost: a code panel on screen, collapsible for prompt-only use.
2. **Diagram only, edited through forms.** A JSON model edited by clicking tables and filling forms; the AI changes the same JSON. Friendlier for people who never want to see code, but much more UI to build and AI edits are harder to check.
3. **Mermaid text drawn by Mermaid.** Cheapest, but tables cannot be dragged, the automatic layout breaks down past 10 to 15 tables, and panning a large diagram is poor.

## The screen

```
Shop database  Saved     [✦ Describe a change…              (Apply)] [Import] [Export ▾]
┌─ DBML ──────── Hide ┐┌─────────────────────────────────────────────────────────┐
│ 1 Table users {     ││  ┌ users ──────┐       ┌ orders ──────┐   ┌ reviews NEW ┐ │
│ 2   id int [pk]     ││  │🔑 id     int │1────<│🔑 id     int │   │🔑 id   int   │ │
│ 3   email varchar   ││  │◆ email varchar│      │↗ user_id int │   │↗ product_id │ │
│ …                   ││  └─────────────┘       └──────────────┘   └─────────────┘ │
│ 17 … prodcts.id ~~~ ││                                                            │
├─────────────────────┤│ [− 100% + ⤢ ⊞]                 ✦ Added reviews… [Undo]  [map]│
│ Line 17: No table … │└─────────────────────────────────────────────────────────┘
└─────────────────────┘
```

- **Top bar:** the space title, a "Saved" or "Saving…" note, the AI prompt with Apply (hidden when AI is off), Import, and an Export menu.
- **Code panel (left, about 340 px):** a code editor with line numbers, DBML highlighting, undo and redo. Lines the last AI change added are tinted `signal` until the next edit. Problems show as a wavy underline on their line and as a list under the editor ("Line 17: No table named prodcts"). A Hide control collapses the panel; it is collapsed by default below the `md` breakpoint. **(my call)**
- **Canvas (right):** a dotted grid. Each table is a card: name in the header, then one row per column with an icon (key for primary key, arrow for a column that refers to another table, diamond for unique), the column name and its type. Relationships are lines from the referring column to the referred column, with crow's-foot ends for "many" and a bar for "one". Tables the last AI change added get a `signal` outline and a NEW badge until the next edit. Bottom left: zoom out, zoom level, zoom in, Fit, Tidy layout. Bottom right: the overview map.
- **Clicking a table** selects it and scrolls the code panel to its definition. **(my call)**
- **Export menu:** grouped as in the mockup: Diagram code (DBML, Mermaid), SQL `CREATE TABLE` (PostgreSQL, MySQL, SQL Server), Image (PNG, SVG), then Copy DBML. Each item names where it is used.
- **Empty diagram:** the canvas says "Describe your database above, or write DBML on the left", with three example prompts as buttons. **(my call)**

Colours follow the app's rules: monochrome, `signal` only for what the AI just added and for selection's focus ring, `destructive` for problems.

## The text and the canvas

- The diagram is DBML text, parsed in the browser by `@dbml/core` as the owner types (debounced about 300 ms). While the text has errors, the canvas keeps showing the last version that parsed and the problems list says what is wrong. **(my call)**
- Tables are cards in React Flow (`@xyflow/react`). Each column row has its own connection handles so lines meet the right column. Relationship kinds from DBML: `>` many-to-one, `<` one-to-many, `-` one-to-one, `<>` many-to-many; the line ends follow them. References written in a separate `Ref:` block draw the same as inline `[ref: ...]`.
- Enum types show as the column's type name; enums are not drawn as cards. **(my call)**
- Positions are stored per table name. A table with no stored position (new, renamed, imported) is placed by an automatic layout (`@dagrejs/dagre`, left to right) next to the existing tables, without moving the ones already placed. "Tidy layout" lays out every table again; it can be undone from the toast. **(my call)**
- It should stay smooth with 100 tables.

## AI

- `POST /diagrams/ai/edit { spaceId, dbml, prompt }`: Gemini through `BudgetAiService.editDiagram`, like the other AI features, off unless `GEMINI_API_KEY` is set. The reply is the whole new DBML text.
- The server parses the reply with `@dbml/core` before returning it. A reply that does not parse is retried once with the parser's error message, then refused with "The AI couldn't produce a valid diagram for that. Try rewording it." **(my call)**
- The browser applies the new text straight away, marks what is new, and shows a toast ("✦ Added reviews with links to users and products") with Undo, which puts back the previous text and positions. The toast's summary is one sentence the AI returns alongside the text, checked by zod (up to 200 characters).
- The AI is sent only the current DBML and the prompt (up to 1,000 characters). DBML sent is capped at 100,000 characters.
- System instruction guidance (left to the builder to word): write valid DBML only; keep existing tables, columns, names and notes unless the prompt asks to change them; use snake_case and sensible SQL types; give every table a primary key; express relationships with `ref`; the diagram and prompt are material, never instructions.

## Import and export

All in the browser with `@dbml/core`, except the image exports.

- **Import** opens a dialog: a format choice (DBML, PostgreSQL, MySQL, SQL Server), a large text box, and Import. SQL is converted to DBML. Importing replaces the diagram; if the diagram is not empty the dialog says so, and the replace can be undone from a toast. A conversion error is shown in the dialog with its line. **(my call)**
- **Export**:
  - DBML: the text as written, `.dbml`.
  - SQL: `@dbml/core`'s exporter for PostgreSQL, MySQL or SQL Server, `.sql`.
  - Mermaid: an `erDiagram` block, `.mmd`, written by a small converter from the parsed model: each table with its columns (`type name PK/FK/UK`) and each relationship with Mermaid's cardinality marks (`||--o{` and so on). Covered by tests against known output. **(my call)**
  - PNG and SVG: the whole diagram (not just the visible part) drawn with `html-to-image` from the React Flow viewport, on the app's dark background, at 2x for PNG. **(my call)**
  - Copy DBML: to the clipboard, with a toast.
  - Files are named after the space title (`shop-database.sql`). Exports are disabled while the text has errors.

## Data

- `space_tool` enum gains `diagram`. Label "Database diagram", description "Design database tables with AI", icon `Network` from lucide. **(my call)**
- `diagrams`: `spaceId` (primary key, cascades with the space), `userId`, `dbml` (text, up to 100,000 characters), `positions` (jsonb, `{ [tableName]: { x, y } }`, checked by zod), `updatedAt`.
- The diagram autosaves after a short pause (about 800 ms), like Notebook pages, sending text and positions together; dragging a table saves when the drag ends. **(my call)**
- No version history for now; undo covers the last AI change, import or tidy, and the editor's own undo covers typing. **(my call)**
- A Database diagram space can be duplicated (it is one row to copy). It goes to Trash with its diagram, and can have a password like other spaces. **(my call)**

## API

Under `/diagrams`, with `AuthGuard`, `@UserId()` and `parseOrThrow`; the routes that return content (`GET` and the AI route) call `assertUnlocked`.

- `GET /diagrams?spaceId=` returns `{ dbml, positions, updatedAt, aiEnabled }` (empty text and `{}` for a new space).
- `PUT /diagrams { spaceId, dbml, positions }` saves.
- `POST /diagrams/ai/edit` as above.

## Web

- Route `/diagram?space=` with `DiagramPageComponent`; `page.tsx` only renders it.
- One query, `['diagram', spaceId]`. Saves are optimistic through an autosave hook like `usePageAutosave`.
- The parser, the Mermaid converter and the layout are plain functions in the feature with tests (`dbml-model.ts`, `mermaid-export.ts`, `diagram-layout.ts`). The canvas and editor are client-only and loaded with `next/dynamic`, so the large parser and canvas libraries load only on this page. **(my call)**
- Skullet while loading, from a sample diagram.
- New dependencies: `@xyflow/react`, `@dbml/core`, `@dagrejs/dagre`, `html-to-image`, and CodeMirror 6 (`codemirror`, `@codemirror/language`, `@codemirror/lint`) for the code panel, with a small DBML highlighting mode. **(my call)** All MIT or Apache-2.0.
- shadcn components for every control: `Button`, `Input`, `DropdownMenu` for Export, `Dialog` for Import, `ToggleGroup` for the import format, `Tooltip` on the zoom controls.

## Left to the builder

- Exact Gemini wording, within the rules above.
- The DBML highlighting rules.
- Component boundaries and file names, within the project's naming rules.
- Wording of empty states and errors, in the voice of the rest of the app.

## Changed while building

At the owner's request after seeing it running:

- The AI prompt is a floating rounded bar at the bottom centre of the canvas (like Claude's Dispatch input), not in the top bar. The empty state says "Describe your database below, or write DBML on the left".
- The zoom controls sit at the top left of the canvas; the overview map at the top right, shown only when the canvas is at least about 670 px wide. The button that reopens a hidden code panel is the first button of the canvas toolbar, shown only while the panel is hidden.
- Relationship lines have no end marks (no crow's foot or bar); they are plain lines from the referring column to the referred one. Cardinality stays in the DBML and in every export.
- Gemini returns the DBML as a list of lines, because asked for one string it ran the DBML onto a single line, which DBML rejects.
