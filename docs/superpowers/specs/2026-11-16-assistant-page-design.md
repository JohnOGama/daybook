# Assistant page (static)

Date: 2026-11-16. Approved mockup: https://claude.ai/artifact/WK8jPrqW5oAUDhTtHNfxAq

## Why

The owner wants a dedicated AI assistant page that feels alive, in a simple monochrome style. It comes before any real AI, so for now it is looks only.

## Goals

- **A full page at `/assistant`.** It is outside any space, like Trash and Preferences, and the sidebar gets an "Assistant" link.
- **The page, as in the mockup:**
  - A round field of white dots in the middle, with a status line under it.
  - A greeting: "Good morning / afternoon / evening. What can I help with?", worked out from the local hour.
  - Three suggested questions, and a rounded input with a send button.
- **Two dot animations that never look alike:**
  - **Idle** ("Ready when you are"): every dot breathes together, slowly (about 5 s per breath).
  - **Thinking** ("Thinking…"): a quick ripple runs out from the centre, dot by dot (about 1.6 s per wave).
  - Under reduced motion the dots stay still.
- **Monochrome only:** white and the theme's greys, with no accent colour.

## Non-goals

- Any AI, any saved conversation, any message list.
- Changing the existing floating assistant panel (`AssistantPanelComponent`).

## Approach

The dots are a grid of small elements animated with CSS keyframes. Each dot's start delay depends on its distance from the centre while thinking, and is zero while idle. Nothing needs a canvas, SVG animation or new package, so there is one sensible way.

## Decided

- **Components** in `features/assistant`:
  - `ThinkingDotsComponent({ thinking })`: an 11×11 grid kept to a circle, about 80 dots, and `role="img"` with the status as its label.
  - `AssistantPageComponent`: the page. The route file `app/(app)/assistant/page.tsx` only renders it.
- **The shell:** `AppShellComponent` treats `/assistant` as outside spaces. `SidebarComponent` adds the link with lucide's `Sparkles` icon, in the same style as Trash.
- **Showing both states (my call):** sending, or picking a suggestion, shows "Thinking…" for 2.5 s, clears the input, then returns to idle. Nothing is sent anywhere. This lets the owner see both animations in the app before the AI exists.
- **Tests:**
  - Idle by default, with the right label.
  - A suggestion switches to thinking and back after 2.5 s (fake timers).
  - An empty input doesn't switch.
  - The dots are kept to a circle.
  - The sidebar link marks the page as current.
