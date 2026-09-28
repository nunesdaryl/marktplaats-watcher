# SegmentedSwitch

The "Search now | Watch it" switch in the composer. It's a `radiogroup` of two `radio` buttons.

- Track: `fill`, 2px inset, radius 8px. Segments: 28px high, `radius-sm`, `text-sm` 500 in `text-2`.
- **Selected** `[aria-checked="true"]`: `elevated` fill, `text`, a 1px `line` ring and a small shadow.
- **`.mode-watch`** (on the composer): the selected segment turns `tag` / `tag-ink`, the composer border turns `tag` and the send button turns `tag`. This is the only place the composer carries the highlight.
- **States:** hover raises the label to `text`; the focus ring sits on the segment.
