# GroupedList

Settings-style groups: the watch form, the Watches and Archived lists, and privacy actions.

- `elevated`, 1px `line`, radius 8px. Rows are at least 48px, with 16px side padding and `text-md` 400 labels. Values sit right-aligned in 500 `text` (`text-3` when they're placeholders; numbers in Geist Mono).
- Dividers are an inset 1px `line` inside the group, never outside.
- A group title above in `text-xs` 500 `text-2`; a group note below in `text-sm` `text-2`.
- **States:** hover `fill`, `.selected` `accent-soft`, focus ring inset. A destructive row uses `danger` text and always opens a confirm.
