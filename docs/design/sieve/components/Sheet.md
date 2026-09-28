# Sheet

Bottom sheets on phones (watch, onboarding, privacy, feedback) and centred sheets on desktop.

- **Phone:** `bg`, top corners `radius-sheet` (16px), a 36×5 `fill-strong` grabber, 16px side padding and the bottom safe-area inset. It slides up over `--dur-sheet` (380ms on phones) with `--ease` onto an `overlay` backdrop.
- **Desktop:** centred, max 520px, radius 16px, `shadow`, the same header.
- **Header:** the title in `text-xl` 600, and a 32px `fill` close button (with a 44px hit area).
- **Onboarding:** a 6px progress bar (`fill` track, `accent` fill) under the header, 3 steps, ending in "Start watching".
- Footer actions are full-width `lg` buttons.
