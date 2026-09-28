# TabBar

The frosted phone tab bar: Chat / Watches / Alerts. Phones only (below 900px).

- `glass` fill with `saturate(1.6) blur(20px)`, a 1px `line` top edge, 6px top padding plus the bottom safe-area inset.
- Each tab is at least 48px high: a 24px icon (1.8 stroke) over a `text-xs` 500 label, `text-2` at rest.
- **Selected** `[aria-selected="true"]`: `accent` icon and label.
- **Count badge:** on Alerts, the Count pill 6px right of centre.
- Pressed: 70% opacity. Focus ring on the tab.
