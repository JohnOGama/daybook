# Assistant Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static, monochrome assistant page at `/assistant` with a field of dots whose idle and thinking animations differ.

**Architecture:** `ThinkingDotsComponent` draws an 11×11 grid of dots, kept to a circle and animated with CSS keyframes in `globals.css`. `AssistantPageComponent` holds the greeting, suggestions and input, and a 2.5 s fake "thinking" state. The shell treats `/assistant` as outside spaces, and the sidebar links to it.

**Tech Stack:** Next.js, React, Tailwind v4, shadcn Button/Input, lucide-react, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-16-assistant-page-design.md` (mockup: https://claude.ai/artifact/WK8jPrqW5oAUDhTtHNfxAq)

## Global Constraints

- Monochrome only: white and theme greys, no accent colour.
- Idle: all dots breathe together, about 5 s, label "Ready when you are". Thinking: a ripple outward from the centre, delay = distance × 0.11 s, about 1.6 s, label "Thinking…". Under reduced motion the dots stay still.
- Greeting: "Good morning / afternoon / evening. What can I help with?" from the local hour: before 12 is morning, before 18 is afternoon, otherwise evening.
- Suggestions: "What's on today?", "How's my budget this month?", "Did the deploy pass?".
- Sending (or a suggestion) shows thinking for 2.5 s and clears the input; nothing is sent anywhere.
- Naming `*Component.tsx`; `page.tsx` only renders the page component; shadcn components; theme tokens.

## Review Focus

1. **Double send:** sending again while thinking must not cut the 2.5 s short or stack timers. Test: Task 1 "a second send while thinking restarts the 2.5 s".
2. **Leaving the page while thinking** must not set state after unmount. Test: Task 1 "unmounting while thinking leaves no timer running".
3. **An input of only spaces** must not start thinking. Test: Task 1 "an empty or blank input does not think".
4. **Reduced motion:** the dots must not animate. Test: Task 1 (the keyframe classes are wrapped in `motion-safe:` or a `prefers-reduced-motion` rule; assert the class names).
5. **Opening `/assistant` with no spaces yet** must still show the page, not "Create your first space". Test: Task 2 (outside-spaces routing).

---

### Task 1: The dots and the page

**Files:**
- Create: `apps/web/src/features/assistant/src/ThinkingDotsComponent.tsx`, `apps/web/src/features/assistant/src/AssistantPageComponent.tsx`, `apps/web/src/app/(app)/assistant/page.tsx`
- Modify: `apps/web/src/features/assistant/index.ts` (export the page), `apps/web/src/app/globals.css` (keyframes `assistant-ripple`, `assistant-breathe`, classes `assistant-dot-thinking`, `assistant-dot-idle`, off under `prefers-reduced-motion`)
- Test: `apps/web/src/features/assistant/src/AssistantPageComponent.test.tsx`

**Interfaces:**
- Produces:
  - `ThinkingDotsComponent({ thinking }: { thinking: boolean })`, with `role="img"` and `aria-label` = the status label.
  - `dotField(): { x: number; y: number; distance: number }[]` (exported): 11×11 on a 16 px grid, keeping `distance <= 5.2`.
  - `greeting(hour: number): string` (exported).
  - `AssistantPageComponent()`.

- [ ] **Step 1: Write the failing tests.**
  - `is idle by default, with the greeting for the hour` (stub the clock to 19:00 → "Good evening. What can I help with?"; img label "Ready when you are").
  - `a suggestion thinks for 2.5 s, then goes back to idle` (fake timers).
  - `sending clears the input and thinks`.
  - `an empty or blank input does not think`.
  - `a second send while thinking restarts the 2.5 s`.
  - `unmounting while thinking leaves no timer running` (`vi.getTimerCount() === 0` after unmount).
  - `dotField keeps a circle`: no dot farther than 5.2 cells, about 80 dots, and the four corners missing.
  - `greeting`: 9 → morning, 12 → afternoon, 18 → evening.
- [ ] **Step 2: Run them to see them fail.**
  Run: `pnpm --filter web exec vitest run src/features/assistant/src/AssistantPageComponent.test.tsx`
  Expected: FAIL (module not found).
- [ ] **Step 3: Implement.**
  A thinking dot gets `animation-delay: distance × 0.11 s`; an idle dot gets no delay. Keep the timer in a ref and clear it on unmount and on a re-send.
- [ ] **Step 4: Run the tests and type check.**
  Run: `pnpm --filter web exec vitest run src/features/assistant && pnpm --filter web exec tsc --noEmit`
  Expected: PASS.
- [ ] **Step 5: Commit** `feat(web): assistant page with thinking dots`.

### Task 2: The route in the shell and the sidebar link

**Files:**
- Modify: `apps/web/src/features/shell/src/AppShellComponent.tsx` (add `/assistant` to the outside-spaces paths), `apps/web/src/features/shell/src/SidebarComponent.tsx` (an "Assistant" link with lucide `Sparkles`, styled like Trash, `aria-current="page"` on `/assistant`)
- Test: `apps/web/src/features/shell/src/SidebarComponent.test.tsx` (create)

**Interfaces:**
- Consumes: Task 1's route.

- [ ] **Step 1: Write the failing test.** `links to the assistant and marks it current on /assistant`: the link `name: 'Assistant'` has `href="/assistant"` and `aria-current="page"` when `usePathname` returns `/assistant`.
- [ ] **Step 2: Run it to see it fail.**
  Run: `pnpm --filter web exec vitest run src/features/shell/src/SidebarComponent.test.tsx`
  Expected: FAIL.
- [ ] **Step 3: Implement both changes.**
- [ ] **Step 4: Run the web suite, the type check and the build.**
  Run: `pnpm --filter web exec vitest run && pnpm --filter web exec tsc --noEmit && pnpm --filter web build`
  Expected: all pass, and the build lists `/assistant`.
- [ ] **Step 5: Commit** `feat(web): assistant in the sidebar`.
