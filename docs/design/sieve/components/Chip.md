# Chip

Suggestion chips under the composer and single-choice chips in Feedback ("Would you pay for this?").

- 36px high, `radius-pill`, `elevated` fill, 1px `line`, `text-sm` 13px. Suggestion chips lead with a 500-weight kind word in `text-2` ("Search", "Watch").
- **Selected** (`.selected` / `[aria-checked="true"]`): `accent-soft` fill, `accent` border and text. Chips in a group are a `radiogroup`.
- **States:** hover `fill`, pressed `fill-strong`, focus ring, disabled 40%.
- Chips never use `tag`; the highlight is reserved for the fill-in sentence.
