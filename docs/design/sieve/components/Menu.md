# Menu

The "…" row menus. They are popovers on desktop and iOS-style action sheets under `@media (hover: none)`.

- **Popover:** 232px, `elevated`, 1px `line`, `radius-lg` (12px), `shadow`, 4px padding. Items are 36px, `radius-sm`, `text-md`, with an 18px `text-2` icon. It fades in over `--dur-fast`.
- **Action sheet:** 56px rows, 17px `accent` text, grouped in 12px-radius `elevated` blocks; "Cancel" sits apart in 600.
- **States:** hover `fill`, focus ring inset, disabled 40%. Destructive items use `danger` and sit last, after a `line` separator.
- Menu item labels here show the pattern; the app's own item copy stays as it is.
