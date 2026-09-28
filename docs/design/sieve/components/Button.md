# Button

Buttons are a verb plus an object, three words at most, in sentence case ("Set up a free watch", "Save watch", "Check now").

| Kind | Fill / text | Use |
|---|---|---|
| primary | `accent` / `accent-ink` | The one main action per view: "Set up a free watch", "Save watch", "Start watching". |
| tinted | `accent-soft` / `accent` | Secondary suggestion inside a thread: "Watch this search". |
| default | `fill` / `text` | Tool actions: Edit, Pause, Check now. |
| plain | transparent / `text` | Low-weight: "Adjust", "Sign in", "Cancel". |
| destructive | `fill` / `danger`; confirm step uses `danger` / `bg` | "Delete my data", "Delete watch". Always confirmed. |
| watch | `tag` / `tag-ink` | Only where the action belongs to Watch mode (the proposal card in Watch mode). |

- **Sizes:** 48px (`lg`, landing CTA, sheet footer, full width on phones), 40px (default), 32px (`sm`, inline toolbars on desktop only; phone targets stay ≥44px through padding). Radius `radius-sm` (6px). Label `text-md` 500 (600 on `lg`).
- **Icon:** 18px, 1.8 stroke, 8px gap, leading.
- **States:** Default, hover, focus (3px `focus` ring, 2px `bg` gap), pressed, disabled (40% opacity, no pointer events). Hover mixes 12% `text` into the fill; pressed 22% (default buttons also scale to .98).
- `[aria-pressed="true"]` shows the tinted look (toggle buttons such as Pin).
- Don't put two primary buttons in one view, and never use `tag` for anything that isn't Watch.
