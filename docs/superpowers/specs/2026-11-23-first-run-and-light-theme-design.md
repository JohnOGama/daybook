# First run and light theme

## Why

A brand-new person landed on a form with all eleven tools and a sidebar that had nothing in it. The app was also dark only. The owner wanted a calmer first page and a light look, based on a reference site's theme (light grey page, white surfaces, black ink, one red-orange accent), with dark kept as an option.

## What

- **No sidebar until the first space exists.** `AppShellComponent` hides it while the spaces list has no `kind: 'space'`, except on Trash, Settings and Assistant. `FirstRunBarComponent` (logo, Settings, Sign out) stands in for it.
- **Welcome instead of a form.** `WelcomeComponent`: "Hi {first name}", "Welcome to Daybook", one line about spaces, six tool icons and a **Browse tools** button. The button opens the existing `CreateSpaceFormComponent` in a dialog; the form now lists tools before the title everywhere.
- **Light by default, Dark in Settings → Appearance.** `next-themes` with `defaultTheme="light"`, no system option, kept per browser. Tokens are in `globals.css` (`:root` light, `.dark` dark); the values and rules are in `docs/theme.md`.
- **Type and shapes in both themes.** Geist for text at weight 500, rounded Nunito for headings, pill buttons and inputs, 28px dialogs, and no shadows in light.
- **Accent rules.** Black does the work. Orange `#cc3f02` is only the keyboard focus ring. Inputs have no border and no focus or error outline. Errors stay red.

## Approaches considered

1. **Light only:** swap the palette. Rejected; the owner wanted to keep dark.
2. **Light by default with a Dark switch (picked):** both palettes as CSS variables, switched by a class on `<html>`.
3. **Follow the system setting:** left out for now; `next-themes` supports it if it's wanted later.

## Calls made while building

- The gold `--signal` is `#b8860b` in light, not the reference `#ffc014`, because the app also uses it as text.
- Buttons keep shadcn's heights (36px by default) rather than the mockup's 40px, so existing toolbars don't shift.
- Things that can't read CSS variables (React Flow's `colorMode`, its minimap) read `useTheme().resolvedTheme`; diagram exports use the current `--background`.
- With no focus style on inputs, the cursor is the only "you're here" sign. This is weak for accessibility, but it was asked for.
