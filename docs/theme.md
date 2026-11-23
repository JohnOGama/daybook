# Theme: colours, type and shapes

A light-first monochrome theme with a matching dark theme. Black does the work, surfaces are flat (no shadows), shapes are pills and big rounded cards. Token names follow shadcn/ui, so the CSS below drops into any shadcn + Tailwind v4 project.

## Rules

- **Black does the work.** Primary buttons, selected items (tool cards, the active day, the active tab), ticks and toggles use `--primary` (black in light, white in dark).
- **Orange `#cc3f02` is only the keyboard focus ring** (`:focus-visible` on buttons and links). It never means anything else.
- **Inputs have no border and no focus or error outline.** They are a plain filled pill: grey (`--muted`) on white surfaces, white on the grey page. A validation error is a short red message below the field.
- **Red is only for errors and delete actions** (`--destructive`), kept apart from orange so focus never looks like an error.
- **Gold is high priority and progress** (`--signal`), as a fill with black text. **Green is done** (`--status-done`).
- **No shadows.** Floating surfaces (dialogs, menus) stand out by colour: white over a dimmed page in light, `--popover` in dark.
- Everything else stays black, white and grey.

## Colours

### Light (default)

| Token | Value | Used for |
|---|---|---|
| `--sidebar` | `#ededed` | Page frame, sidebar, full-screen pages such as the welcome screen |
| `--background` | `#ffffff` | Main panel |
| `--foreground` | `#000000` | Text |
| `--card` | `#ffffff` | Cards on the grey page |
| `--popover` | `#ffffff` | Dialogs, menus |
| `--primary` | `#000000` | Primary buttons, selected states |
| `--primary-foreground` | `#ffffff` | Text on primary |
| `--muted` / `--accent` / `--secondary` | `#f3f3f3` | Input fill on white, secondary buttons, hover, cards on white |
| `--muted-foreground` | `rgb(0 0 0 / 0.5)` | Secondary text |
| `--border` / `--input` | `#ebebeb` | Dividers (2px), card outlines when needed |
| `--ring` | `#cc3f02` | Keyboard focus ring |
| `--destructive` | `#d92d20` | Errors, delete |
| `--signal` | `#ffc014` | High priority, progress (fill only) |
| `--status-done` | `#2f9e67` | Done |
| `--overlay` | `rgb(0 0 0 / 0.2)` | Behind dialogs |

### Dark

| Token | Value |
|---|---|
| `--sidebar` | `#0a0a0a` |
| `--background` | `#000000` |
| `--foreground` | `#ffffff` |
| `--card` | `#121212` |
| `--popover` | `#0d0d0d` |
| `--primary` | `#ffffff` |
| `--primary-foreground` | `#000000` |
| `--muted` / `--accent` / `--secondary` | `#1f1f1f` |
| `--muted-foreground` | `#a3a3a3` |
| `--border` / `--input` | `#2e2e2e` |
| `--ring` | `#cc3f02` |
| `--destructive` | `#ef4444` |
| `--signal` | `#d9a514` |
| `--status-done` | `#4fbf85` |
| `--overlay` | `rgb(0 0 0 / 0.6)` |

### Contrast notes

- `--muted-foreground` at 50% black on white is about 4:1, just under WCAG AA for small text. If a project needs AA, use `rgb(0 0 0 / 0.55)` (about 4.7:1).
- Gold and green don't have enough contrast to be small text on white. Use them as fills, icons or dots, with black text on gold. If a project also colours text with `--signal`, use `#b8860b` in light instead (Daybook does).

## Type

### Families

| Role | Family | Stack |
|---|---|---|
| Text | Geist | `Geist, ui-sans-serif, system-ui, sans-serif` |
| Headings, logo, big numbers | Nunito (rounded) | `ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif` |

Both fonts are on Google Fonts:

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Nunito:wght@700;800;900&display=swap" rel="stylesheet">
```

In Next.js, use `next/font/google` (`Geist`, `Nunito`) and point `--font-sans` and `--font-display` at their variables.

Body text is weight **500**, not 400. Headings are heavy (800–900) with tight letter-spacing.

### Sizes

| Style | Size / line height | Weight | Letter-spacing | Family |
|---|---|---|---|---|
| Hero (welcome) | 44px / 1.02 | 900 | -0.035em | Display |
| Page title | 28px / 1.2 | 800 | -0.03em | Display |
| Section title | 22px / 1.25 | 800 | -0.03em | Display |
| Dialog title | 17px / 1.3 | 800 | -0.03em | Display |
| Card title | 15px / 1.3 | 800 | -0.03em | Display |
| Lead (intro text) | 17px / 1.4 | 500 | -0.02em | Text |
| Body | 14px / 1.5 | 500 | -0.01em | Text |
| Button, tab | 14px / 1 | 600 | -0.02em | Text |
| Small | 13px / 1.45 | 500 | -0.01em | Text |
| Caption, hint | 12px / 1.4 | 500 | 0 | Text |
| Label (uppercase) | 11px / 1.2 | 600 | 0.04em | Text |

## Shapes and spacing

| Thing | Value |
|---|---|
| Buttons, inputs, tabs, nav items, badges | Fully rounded (`9999px`), 40px tall, 18px side padding |
| Cards, dialogs, main panel corner | 28px |
| Tool or option cards | 20px, 2px border in `--muted`, black border when selected |
| Icon tiles | 10–12px |
| Borders | 2px, `--muted` or `--border`, never darker |
| Focus ring | 3px solid `--ring`, 2px offset, `:focus-visible` only |
| Shadows | None |

## Components

- **Primary button:** `--primary` fill, `--primary-foreground` text, pill.
- **Secondary button:** `--muted` fill, `--foreground` text, no border.
- **Ghost button:** no fill; `--muted` on hover.
- **Input:** `--muted` fill (or white on the grey page), no border, no focus style; the cursor is the only active sign. Placeholder in `--muted-foreground`.
- **Segmented tabs** (days, views): a `--muted` pill track with 4px padding; the selected tab is a black pill with white text.
- **Selected option card:** a 2px black border with no tinted fill.
- **Sidebar item:** a pill; the active item is white on the grey sidebar in light, `--muted` in dark.
- **Badge:** a pill; the high-priority badge is a gold fill with black 700-weight text.

## CSS (Tailwind v4 + shadcn/ui)

```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

:root {
  color-scheme: light;
  --sidebar: #ededed;
  --background: #ffffff;
  --foreground: #000000;
  --card: #ffffff;
  --card-foreground: #000000;
  --popover: #ffffff;
  --popover-foreground: #000000;
  --primary: #000000;
  --primary-foreground: #ffffff;
  --secondary: #f3f3f3;
  --secondary-foreground: #000000;
  --muted: #f3f3f3;
  --muted-foreground: rgb(0 0 0 / 0.5);
  --accent: #f3f3f3;
  --accent-foreground: #000000;
  --destructive: #d92d20;
  --signal: #ffc014;
  --status-done: #2f9e67;
  --border: #ebebeb;
  --input: #ebebeb;
  --ring: #cc3f02;
  --overlay: rgb(0 0 0 / 0.2);
  --radius: 1.75rem;
  --font-sans: Geist, ui-sans-serif, system-ui, sans-serif;
  --font-display: ui-rounded, "SF Pro Rounded", Nunito, system-ui, sans-serif;
}

.dark {
  color-scheme: dark;
  --sidebar: #0a0a0a;
  --background: #000000;
  --foreground: #ffffff;
  --card: #121212;
  --card-foreground: #ffffff;
  --popover: #0d0d0d;
  --popover-foreground: #ffffff;
  --primary: #ffffff;
  --primary-foreground: #000000;
  --secondary: #1f1f1f;
  --secondary-foreground: #ffffff;
  --muted: #1f1f1f;
  --muted-foreground: #a3a3a3;
  --accent: #1f1f1f;
  --accent-foreground: #ffffff;
  --destructive: #ef4444;
  --signal: #d9a514;
  --status-done: #4fbf85;
  --border: #2e2e2e;
  --input: #2e2e2e;
  --overlay: rgb(0 0 0 / 0.6);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-signal: var(--signal);
  --color-status-done: var(--status-done);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --font-sans: var(--font-sans);
  --font-display: var(--font-display);
  --radius-lg: var(--radius);
  --radius-md: 1.25rem;
  --radius-sm: 0.75rem;
}

@layer base {
  body {
    @apply bg-background text-foreground font-sans antialiased;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  h1, h2, h3, h4 {
    font-family: var(--font-display);
    font-weight: 800;
    letter-spacing: -0.03em;
  }
  :focus-visible {
    outline: 3px solid var(--ring);
    outline-offset: 2px;
  }
  input:focus,
  textarea:focus {
    outline: none;
  }
}
```

Start in light by leaving `class="dark"` off `<html>`. Add it to switch to dark.
