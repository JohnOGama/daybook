# Assistant page

## Assistant page

- `/assistant` (`features/assistant`, `AssistantPageComponent`) lives outside spaces like Trash and Settings, and the sidebar links to it. It is looks only: sending a message or picking a suggestion shows "Thinking…" for 2.5 s, then goes back to idle, and nothing is sent anywhere. The floating `AssistantPanelComponent` is separate and unchanged.
- `ThinkingDotsComponent` draws an 11×11 grid of dots kept to a circle (`dotField`). Each dot carries fixed timings and directions as CSS variables, the same on every render. Each dot is two spans: the outer one breathes and takes the hover push, the inner one floats and twinkles.
- Both animations always run (keyframes in `globals.css`). The field's `assistant-field-thinking` class only turns the registered `@property --amp` from 0 to 1 over 0.7 s, so switching state never restarts a dot and each one glides from where it is. Don't swap animations per state; that brings back the jump.
- Hover moves are written straight onto the dots once a frame (`pushAway`), never through React state. They use the separate `translate` and `scale` properties so they add to the keyframe transforms.
- The owner asked for the movement, so these animations are `!important` and run even with reduced motion on, beating the app-wide reduced-motion rule.
