# ScoreBadge

The score, the brand's most recognisable unit. It is always shown next to its one-line reason, never alone.

- Text: Geist Mono 500 13px, `score` style, always "N/10" (no spaces).
- 24px high, 8px side padding, `radius-sm`. The large version is 40×48 at 15px, for e-mail and sample rows.
- **great** (score ≥8): `great` / `great-ink`.
- **good** (6–7): `good` / `good-ink`. Good has the same value as `tag`, so "passed your bar" reads as the highlight.
- **neutral** (below 6): `glass` with a `line` ring, `text-2`. It stays readable on photos through its backdrop blur.
- Great and good differ in lightness as well as hue, so they stay distinct without colour. Screen readers get "Scored 9 out of 10".
