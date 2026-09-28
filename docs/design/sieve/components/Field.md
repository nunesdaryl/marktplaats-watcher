# Field

Text inputs and the feedback textarea. Inside settings-style groups, fields become GroupedList rows; standalone fields use this spec.

- 44px high, `radius-sm`, `surface` fill, no border at rest, 17px text (so iOS doesn't zoom). Labels `text-sm` 500 in `text-2`, 6px above.
- **Placeholder:** `text-3` (4.5:1 on `surface` light, 5.2:1 dark).
- **States:** hover shows a 1px `line` border. Focus: `elevated` fill, `focus` border, plus a 3px `focus` 25% halo. Error: `danger` border and a `danger` 13px message below that says what to do. Disabled 50%.
- Numbers (max price, postcode) use Geist Mono when displayed and `inputmode="numeric"` when typed.
