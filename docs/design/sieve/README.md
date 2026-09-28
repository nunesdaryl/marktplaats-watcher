Marktplaats Watcher is the calm, explained layer on top of Marktplaats: only the new listings worth a look, each with a score and the reason. This system (direction "Sieve") restyles the live app one-to-one. Every feature, layout and string stays; only the visual layer changes.

The whole system in one line: **warm graphite surfaces, one teal accent, one lilac highlight, Geist for words and Geist Mono for numbers.**

## Content fundamentals

- **Voice:** the friend at the dinner party who actually knows how Marktplaats works. Calm, practical, a bit dry. Numbers beat adjectives. Honest about limits. Never hype, never urgency.
- **Use the app's real strings.** The mockups quote them exactly: "What are you looking for?", "Set up a free watch", "No card, no app to install.", "No new matches yet. When a check finds a good one, we'll e-mail you."
- **Formats:** prices `€230` (no decimals, no space), scores `9/10`, times `08:00` (24-hour), sentence case everywhere, buttons are a verb plus an object in three words or fewer.
- **Allowed claims only, with their qualifiers:** "Free, up to 5 watches"; "Scores every new listing 0 to 10 and says why"; "Checks from every 15 minutes, Amsterdam time"; "20/20 chat test cases passed"; "13/13 listings scored 8 or more agreed with a stronger AI judge (68% recall; human check pending)"; "An hourly watch finding one new listing an hour costs about €0.35 a month in AI cost".
- **Never:** instant, real-time, as soon as, be the first, never miss, guaranteed, AI-powered, revolutionary, seamless, "smart" as a claim; testimonials, user counts or ratings; exclamation marks; emoji in the product or the e-mail.
- **"Not affiliated with Marktplaats"** appears on the landing footer, the e-mail footer, the OG image and every social template.

## Colour

- Theme follows the device (`prefers-color-scheme`). Paste `app/tokens.css`: a `:root` block and a `@media (prefers-color-scheme: dark)` block. Every section-8 token has both values, including `--tag`, `--tag-ink` and `--accent-ink`.
- **Neutrals are warm graphite and warm off-white** (hue around 35°, low chroma): `bg` `#fbfaf7` / `#151412`, `text` `#1b1a18` / `#ece9e4`. Never blue-grey.
- **`accent` (teal `#0d6b62` / `#4fd1bf`) is the one accent:** links, primary buttons, the active tab, the focus ring. In dark, text on teal is `accent-ink` `#06201c`, not white.
- **`tag` (lilac `#ddd0ff` / `#bca8ff`) is the one highlight:** fill-in pills, schedule select pills, Watch mode, the proposal bar and the good badge. One loud element per screen.
- **Scores:** `great` green for 8–10, `good` equal to `tag` for 6–7, and `glass` neutral below 6. Great and good differ in lightness as well as hue.
- `danger` and `warn` always come with words. `logo-tile` lifts from `#1b1a18` to `#2b2926` on dark grounds.
- **Distance from Marktplaats:** no orange or amber anywhere (the old `#f2a900` is gone), no action blue (`#0071e3` is gone), no navy-plus-blue pairing, no slab serif, no circle or arrow mark, no top stripe, no heart-save buttons, no ad-like flags.

## Typography

- **Geist** 400 / 500 / 600 for words, and **Geist Mono** 400 / 500 for every score, price, time and count. Both are SIL Open Font License 1.1 (© 2023 Vercel, with basement.studio). They're self-hosted from `fonts/` (`geist-sans-latin-{400,500,600}-normal.woff2`, `geist-mono-latin-{400,500}-normal.woff2`), because the CSP is `font-src 'self'`. Ship the OFL text beside the files.
- Tabular alignment comes for free from the mono. Where Geist sits next to numbers, set `font-variant-numeric: tabular-nums`.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `display` | clamp(34px, 5.4vw, 56px) / 1.12 | 600, -0.035em | Landing fill-in sentence |
| `display-s` | 32 / 38 | 600, -0.03em | Page h1 |
| `text-xl` | 22 / 30 | 400 lede, 600 titles | Lede, sheet titles, chat empty-state title |
| `text-lg` | 17 / 26 | 400 (pills 600) | Body, composer, schedule sentence |
| `text-md` | 15 / 22 | 500 buttons, 600 card titles | Buttons, nav, card titles, list rows |
| `text-sm` | 13 / 18 | 400 | Reason line, chips, hints, menus |
| `text-xs` | 12 / 16 | 500 | Section and tab labels, meta |

That's five UI sizes plus display. The old 11, 14, 16, 18, 20, 28 and 34px sizes map to the nearest step.

## Space, shape, depth, motion

- **Spacing:** `space-1`…`space-6` = 4 / 8 / 16 / 24 / 32 / 48. Never 13 or 27.
- **Radii:** `radius-sm` 6px (controls, badges, pills in sentences), `radius` 8px (cards, groups, rows), `radius-lg` 12px (composer, menus, toast), `radius-sheet` 16px, `radius-pill` for dots, chips and the send button. It's a tighter, more precise set than today's 14/24px.
- **Depth:** hairlines (`line`) first, and `shadow` only on floating things: cards, composer, menus, sheets. Frosted `glass` only on the phone bars.
- **Motion:** `--ease` stays. `--dur-fast` 140ms for menus and hover, `--dur` 200ms for toast, card and pill fade-in, `--dur-sheet` 320ms (380ms on phones), and `--dur-breathe` 1600ms for the boot logo (scale 0.94 and 72% opacity at the midpoint). `prefers-reduced-motion` sets all of them to 0.
- **Layout:** desktop from 900px with the 272px ChatGPT-style sidebar; phone below with the frosted top bar, the Chat / Watches / Alerts tab bar and bottom sheets. Touch targets are at least 44px, with safe-area insets.
- **Focus:** a 3px `focus` ring with a 2px `bg` gap (`--focus-ring`), at least 3:1 on every surface.

## Logo

- **Symbol:** a warm graphite tile with three teal bars narrowing to one lilac dot. It's a sieve: only the good ones get through. It works alone as the app icon, favicon, sidebar, top bar and boot tile, replacing the 🛒 emoji.
- **Wordmark:** "Marktplaats" in Geist 400 `text-2`, "Watcher" in Geist 600 `text`. Watcher carries the weight, so the third-party name reads as context. The SVGs are outlined paths.
- **Lockups:** horizontal and stacked, each in light, dark, mono black and mono white (see the Logos assets and the LogoSystem card). Clear space is 1/4 of the symbol width. Minimum sizes: symbol 16px (the favicon-16 drawing below 24px), horizontal lockup 120px wide, stacked 96px.
- **Don't:** recolour the bars, add a circle behind the mark, set the wordmark in any other face, put the lockup on busy photos, or put anything orange next to it.
- **Boot screen:** the symbol at 64px on `bg`, breathing. There's no spinner.

## Components

Button, Chip, Pill, SegmentedSwitch, ScoreBadge, ListingCard, ProposalCard, FillInSentence, ScheduleSelect, Field, GroupedList, SidebarRow, TabBar, Sheet, Menu, Toast and Composer each have a card with its states (default, hover, focus, pressed, disabled, selected) and a spec. `components/bundle.css` is the reference CSS. It keeps the app's state hooks: `.active`, `.on`, `.open`, `.selected`, `.mode-watch`, `[aria-checked]`, `[aria-pressed]`, `.returning`, `.boot-landing`, `.boot-wait`. The Screens cards show landing, the desktop chat thread, the phone watch page, the watch sheet and the alert e-mail, in light and dark.

## Alert e-mail

`email/alert-email.template.html` is the pattern, with `{{…}}` fields for `renderEmail`; `email/alert-email.example.html` is filled with real data.

- Tables, inline styles and system fonts only (Geist can't load in mail), max 560px.
- Light values are inline. A small `prefers-color-scheme` block switches to the dark values in clients that support it, and every pair is at least 4.5:1, so forced inversion stays readable.
- **Badge by score:** 8 or more is `#157346` on white; 6 or more is `#ddd0ff` on `#25124f`; lower is `#eeebe6` on `#5b5751`.
- **Subject:** "{watch}: {n} new match(es), best {score}/10 at €{price}".
- **Logo:** 28px `apple-touch-icon.png` from the app's own origin.

## Iconography

- **Keep the app's own 26-icon set:** 24px grid, 1.8 stroke, round caps and joins, no fills (except the play triangle and the "more" dots), drawn in the spirit of SF Symbols. The Icons card shows a matching reference drawing of all 26 (compose, chat, eye, bell, up, clock, plus, chevron, back, close, trash, pause, play, refresh, edit, external, feedback, shield, sidebar, more, pin, archive, folder, copy, search, restore).
- **Colour:** `text-2` at rest, `text` on hover, `accent` when selected (tab bar), `danger` for destructive items. Icons never carry `tag`.
- **Sizes:** 24px in the tab and top bars, 18px in buttons, rows and menus, 16px in dense sidebar controls.
- **Replacement, if one is ever needed:** Lucide (ISC licence) at `stroke-width="1.8"`, mapped as compose→square-pen, chat→message-circle, eye→eye, bell→bell, up→arrow-up, clock→clock, plus→plus, chevron→chevron-right/down, back→chevron-left, close→x, trash→trash-2, pause→pause, play→play, refresh→rotate-cw, edit→pencil, external→external-link, feedback→message-square-text, shield→shield, sidebar→panel-left, more→ellipsis, pin→pin, archive→archive, folder→folder, copy→copy, search→search, restore→archive-restore.
- No emoji as icons, and no fire, lightning, tag or cart glyphs.

## Clerk sign-in

Theme the modal with `appearance.variables`: colorPrimary `#0d6b62` (dark `#4fd1bf`, with colorTextOnPrimaryBackground `#06201c`), colorBackground `#fbfaf7` / `#1e1c1a`, colorText `#1b1a18` / `#ece9e4`, colorTextSecondary `#5b5751` / `#a9a49c`, colorInputBackground `#eeebe6` / `#252321`, borderRadius `6px`, fontFamily `Geist, system-ui, sans-serif`.

## Accessibility: contrast (WCAG 2)

Alpha tokens are composited on `bg`. Every pair passes in both themes.

| Pair | Used for | Needs | Light | Dark |
|---|---|---|---|---|
| `text` on `bg` | Body text | 4.5:1 | 16.66 | 15.20 |
| `text` on `sidebar` | Sidebar rows | 4.5:1 | 15.55 | 15.93 |
| `text` on `surface` | Bubble, fields | 4.5:1 | 14.63 | 14.03 |
| `text` on `elevated` | Cards, menus | 4.5:1 | 17.39 | 12.93 |
| `text` on `fill-strong` | Active sidebar row | 4.5:1 | 13.34 | 10.46 |
| `text` on `glass` | Tab bar labels | 4.5:1 | 16.66 | 15.20 |
| `text-2` on `bg` | Secondary | 4.5:1 | 6.87 | 7.43 |
| `text-2` on `sidebar` | Watch schedule line | 4.5:1 | 6.42 | 7.78 |
| `text-2` on `surface` | Hints in groups | 4.5:1 | 6.03 | 6.86 |
| `text-2` on `elevated` | Card meta | 4.5:1 | 7.17 | 6.32 |
| `text-3` on `bg` | Tertiary | 4.5:1 | 5.15 | 5.59 |
| `text-3` on `elevated` | Composer placeholder | 4.5:1 | 5.38 | 4.75 |
| `text-3` on `surface` | Field placeholder (UI 3:1) | 3.0:1 | 4.52 | 5.15 |
| `accent` on `bg` | Links | 4.5:1 | 6.10 | 9.82 |
| `accent` on `elevated` | Links in cards | 4.5:1 | 6.37 | 8.36 |
| `accent` on `sidebar` | Active tab icon | 3.0:1 | 5.70 | 10.29 |
| `accent-ink` on `accent` | Primary button | 4.5:1 | 6.37 | 9.10 |
| `accent` on `accent-soft` | Tinted button | 4.5:1 | 5.28 | 7.55 |
| `tag-ink` on `tag` | Fill-in pills, good badge | 4.5:1 | 11.38 | 8.76 |
| `great-ink` on `great` | Great badge | 4.5:1 | 5.88 | 8.99 |
| `great` on `sidebar` | Active-watch dot | 3.0:1 | 5.26 | 10.49 |
| `danger` on `bg` | Destructive text | 4.5:1 | 6.30 | 7.23 |
| `danger` on `elevated` | Menu destructive item | 4.5:1 | 6.57 | 6.15 |
| `warn` on `bg` | Watch error line | 4.5:1 | 6.38 | 9.20 |
| `focus` on `bg` | Focus ring | 3.0:1 | 6.10 | 9.82 |
| `focus` on `surface` | Focus ring in groups | 3.0:1 | 5.36 | 9.06 |
| `focus` on `elevated` | Focus ring on cards | 3.0:1 | 6.37 | 8.36 |
| `text-2` on `fill` | Default button, switch track label | 4.5:1 | 6.12 | 6.23 |

## Logo geometry (for GPT Images)

The symbol is a square app-icon tile on a 32-unit grid with corner radius 8 units (25% of the side), filled warm graphite #1b1a18. Inside it are three horizontal bars stacked and centred on the vertical axis, all 3 units tall with fully rounded ends (radius 1.5 units), in bright teal #4fd1bf: the top bar is 20 units wide (62.5% of the tile, 6 units in from each side) and sits 5 units from the top edge; the middle bar is 12 units wide (60% of the top bar); the bottom bar is 6 units wide (30% of the top bar). The gaps between bars are exactly 3 units, equal to the bar height. Below the bottom bar, after the same 3-unit gap, sits one solid circle in soft lilac #bca8ff, 4 units in diameter (a third wider than the bar height, two-thirds of the bottom bar's width), centred horizontally, with its bottom edge 5 units above the tile's bottom so the top and bottom margins match. The whole mark reads as a funnel or sieve letting one good item through: flat, geometric, perfectly symmetric left to right, no gradients, no outlines, no shadows.
