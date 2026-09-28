# FillInSentence

The signature: the user's choices as `tag` pills inside one plain sentence. It is the landing hero, the watch summary, the proposal and the schedule editor.

- **Pill:** `tag` fill, `tag-ink` text, radius 6px, 0.22em side padding, a 1px `tag-ink` 10% inner ring, `box-decoration-break: clone` so wrapped pills keep their ends.
- **Display** (landing): `display` style, Geist 600, clamp(34px, 5.4vw, 56px), tracking -0.035em. The words after the last pill (", with the reason.") are `text-2`.
- **Inline** (watch page, proposal): `text-lg`, pills in 600 weight with 2px/6px padding.
- **Motion:** the landing cycles 3 examples every 3.2s; each pill fades its `tag` in over `--dur` with `--ease` ("tag-in"). Under reduced motion it doesn't cycle.
- One sentence per screen. Nothing else on that screen uses `tag`, except a good badge.
