# Composer

The chat input: the Search now / Watch it switch, the text area and the send button.

- `elevated`, 1px `line`, `radius-lg` (12px), `shadow`, 8px padding. Text is `text-lg`, the placeholder `text-3`.
- **Send:** a 32px round button, `text` fill with a `bg` arrow; `fill-strong` when there's nothing to send.
- **`.mode-watch`:** the border, the selected segment and the send button all turn `tag`. This is the only state change; the layout doesn't move.
- **Focus:** the whole composer gets the focus ring (focus-within).
