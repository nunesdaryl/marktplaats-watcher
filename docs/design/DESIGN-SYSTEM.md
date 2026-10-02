# Marktplaats Watcher design system

Source of truth for the app's look and language. Generated from `frontend/src/styles.css` on 1 Oct 2026.

Where it comes from: the "Sieve" direction (Claude Design, 28 Sep, `docs/design/sieve/`), applied one-to-one to the app on
29–30 Sep (MW-15, system design §14). Older documents are kept as history and marked superseded:
`references/current-app-design-inventory.md`, `docs/design/sieve/README.md`, `docs/design/claude-design-brief.md`.
`references/marktplaats-design-language.md` is not ours: it records Marktplaats' look so we stay clear of it.

When this file and `styles.css` disagree, `styles.css` is what users see: fix whichever is wrong, then re-run the check in
§12.

---

## 1. Principles

1. **Calm surfaces, one loud element.** Warm graphite neutrals; the only loud thing on a screen is the lilac fill-in
   sentence (landing) or, in the app, the content itself: photos, scores, prices.
2. **One accent.** Teal (`--accent`) means "you can act here or you are here": links, primary buttons, the active tab, focus,
   counts. Lilac (`--tag`) is the signature highlight and the "good" score. Nothing else gets colour.
3. **Hairlines first, shadows only on floating things.** Cards and menus float; rows, lists and fields use 1px `--line`.
4. **Numbers in mono.** Scores, prices, times and counts use Geist Mono with tabular figures.
5. **Real states, not decoration.** Every component has hover, focus, disabled, busy, empty and error states before it
   ships. Colour is never the only signal.
6. **Motion settles once.** One short ease on enter or change; no loops except loading indicators; nothing under reduced
   motion.
7. **Apple-calm, ChatGPT-simple layout.** Sidebar and main on desktop; top bar and tab bar on phones (§9).
8. **Plain words.** The friend who knows Marktplaats: calm, practical, a bit dry, honest about limits (§11).

## 2. Colour

Defined in three blocks that must stay in step: light `:root` (`styles.css:13-42`), dark by device
`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` (`:88-121`) and dark by the sun/moon toggle
`:root[data-theme="dark"]` (`:123-154`). `:root[data-theme="light"]` (`:122`) only sets `color-scheme`.

### Surfaces and text

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#fbfaf7` | `#151412` | page, sheets, skipped cards |
| `--sidebar` | `#f4f2ee` | `#0f0e0d` | desktop sidebar |
| `--surface` | `#eeebe6` | `#1e1c1a` | user bubble, photo placeholder, fields, admin search |
| `--elevated` | `#ffffff` | `#252321` | cards, composer, menus, grouped lists, chips, proposal |
| `--fill` | `rgba(94,84,72,0.08)` | `rgba(232,224,212,0.08)` | default button, hover, search bar, segmented track, skeleton bars |
| `--fill-strong` | `rgba(94,84,72,0.15)` | `rgba(232,224,212,0.15)` | button hover, active nav row, disabled send |
| `--line` | `rgba(42,36,30,0.11)` | `rgba(232,224,212,0.11)` | every border and divider |
| `--text` | `#1b1a18` | `#ece9e4` | primary text; toast fill (inverted) |
| `--text-2` | `#5b5751` | `#a9a49c` | secondary text, meta, icons at rest |
| `--text-3` | `#6e6a63` | `#928d85` | tertiary text, placeholders, paused-watch ring |
| `--overlay` | `rgba(20,17,14,0.36)` | `rgba(0,0,0,0.58)` | sheet backdrop, drill scrim, touch menus |
| `--glass` | `rgba(251,250,247,0.8)` | `rgba(21,20,18,0.78)` | top bar, tab bar, score badge on photos (with blur) |

### Accent, highlight and status

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--accent` | `#0d6b62` | `#4fd1bf` | links, primary button, active tab, counts, focus |
| `--accent-ink` | `#ffffff` | `#06201c` | text on `--accent` |
| `--accent-soft` | `rgba(13,107,98,0.10)` | `rgba(79,209,191,0.14)` | tinted button, pill, banner, selected row |
| `--focus` | `#0d6b62` | `#4fd1bf` | focus outline and rings (= accent) |
| `--tag` | `#ddd0ff` | `#bca8ff` | signature fill-in sentence, Watch mode, "good" score |
| `--tag-ink` | `#25124f` | `#190d3b` | text on `--tag` |
| `--great` | `#157346` | `#58d68e` | "great" score, active-watch dot, toast check, done text |
| `--great-ink` | `#ffffff` | `#062414` | text on `--great` |
| `--good` | `var(--tag)` | `var(--tag)` | "good" score (same lilac as the tag) |
| `--good-ink` | `var(--tag-ink)` | `var(--tag-ink)` | text on `--good` |
| `--danger` | `#b42318` | `#ff7a6b` | errors, destructive actions |
| `--danger-ink` | `#ffffff` | `#2a0703` | text on `--danger` |
| `--warn` | `#8f4a0c` | `#f5a65c` | warnings ("can't keep up") |

### Logo and shadow

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--logo-tile` | `#1b1a18` | `#2b2926` | logo tile |
| `--logo-bar` | `#4fd1bf` | `#4fd1bf` | logo bar |
| `--logo-dot` | `#bca8ff` | `#bca8ff` | logo dot |
| `--shadow` | `0 1px 2px rgba(40,30,20,.05), 0 8px 28px rgba(40,30,20,.08)` | `0 1px 2px rgba(0,0,0,.3), 0 12px 32px rgba(0,0,0,.42)` | anything that floats: cards, menus, composer, toast |

Rules: one accent (teal) per screen's actions; lilac never on icons or controls other than Watch mode; no orange, navy
or action blue (that is Marktplaats' look); no new colours without §12.

## 3. Typography

Fonts are self-hosted (`styles.css:4-8`, `font-display: swap`): Geist 400/500/600 and Geist Mono 400/500. Only these
weights exist; 700 would be a faked bold, so `b, strong` are 600 (`:175`).

| Token | Value | Use |
|---|---|---|
| `--font` | `"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | everything |
| `--font-display` | `"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` | h1–h3 |
| `--font-mono` | `"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace` | scores, prices, times, counts, code |
| `--text-xs` / `--text-xs-lh` | `12px` / `16px` | section labels, tab labels, meta, badges |
| `--text-sm` / `--text-sm-lh` | `13px` / `18px` | reason line, chips, pills, hints, menus |
| `--text-md` / `--text-md-lh` | `15px` / `22px` | buttons, nav, card titles, list rows |
| `--text-lg` / `--text-lg-lh` | `17px` / `26px` | body (`body` uses `--text-lg`/1.5), composer |
| `--text-xl` / `--text-xl-lh` | `22px` / `30px` | lede, sheet titles, chat empty-state title |
| `--display` / `--display-lh` | `clamp(34px, 5.4vw, 56px)` / `1.12` | landing fill-in sentence |
| `--display-s` / `--display-s-lh` | `32px` / `38px` | page h1 (Watches, Alerts, Dashboard, watch page) |
| `--tracking-display` | `-0.035em` | display sentence |
| `--tracking-title` | `-0.015em` | titles |

Headings: `letter-spacing: -0.02em; line-height: 1.2` (`:167`). Sentence case everywhere. Numbers use
`font-variant-numeric: tabular-nums` where they line up (counts, tables).

## 4. Space, radius and elevation

**Spacing scale: 4 / 8 / 16 / 24 / 32 / 48, nothing else.** A literal outside the scale is allowed only for layout and
must carry `/* off-scale: layout */` on the same declaration (§12).

| Token | Value | Token | Value |
|---|---|---|---|
| `--space-1` | `4px` | `--space-4` | `24px` |
| `--space-2` | `8px` | `--space-5` | `32px` |
| `--space-3` | `16px` | `--space-6` | `48px` |

| Radius | Value | Use |
|---|---|---|
| `--radius-sm` | `6px` | controls: buttons, fields, segmented switch, badges, menu items, code |
| `--radius` | `8px` | cards, grouped lists, sidebar rows, icon buttons, count badge |
| `--radius-lg` | `12px` | composer, menus, toast, banner, search bar |
| `--radius-sheet` | `16px` | sheets (top corners on phones) |
| `--radius-pill` | `999px` | chips, pills, send button, avatar |

Elevation has two levels: flat (hairline `1px solid var(--line)`, no shadow) and floating (`var(--shadow)`). Cards,
the composer, menus, the toast and the proposal float. Rows, lists and fields don't.

Layers: `--z-sidebar: 10`, `--z-bars: 20`, `--z-menu: 40`, `--z-overlay: 50`, `--z-toast: 55`, `--z-sheet: 60`.
Sizes: `--sidebar-w: 272px`, `--touch: 44px`, `--focus-ring: 0 0 0 2px var(--bg), 0 0 0 5px var(--focus)`.

## 5. Motion

| Token | Value | Use |
|---|---|---|
| `--ease` | `cubic-bezier(0.32, 0.72, 0, 1)` | every transition and animation |
| `--dur-fast` | `140ms` | menu fade, hover |
| `--dur` | `200ms` | toast, card, highlight |
| `--dur-sheet` | `320ms` | sheet up (phones use 380ms, `:636`) |
| `--dur-breathe` | `1600ms` | boot logo breathing |

Patterns that exist (keyframes): `menu-in` (`:295`), `toast-in` (`:330`), `sheet-in` (`:519`), `sheet-up` (`:637`),
`tag-in` (`:593`, a highlight that fades in once), `drill-in` and `fade-in` (`:876-877`), and two loading loops:
`shimmer` (status text while the AI works, `:395`) and `breathe` (boot logo, `:572`).

Rules:
- Enter or change with one settle on `--dur`/`--ease` (or `--dur-fast` for hover). No bounce, no overshoot, no loops,
  except a loading indicator while something is actually loading.
- Hover lift on cards: `translateY(-2px)` (`.listing:hover`, `:442`).
- Reduced motion, in two places: the duration tokens drop to `0ms` (`:156-158`), and a global rule sets every animation
  and transition to `0.01ms` with one iteration (`:681-683`). New motion must use the tokens so both apply.
- Anything that moves is reviewed by recording real playback (global review rule), not from a still.

## 6. Icons

`frontend/src/components/Icon.jsx`: one line-icon set on a 24px grid, `stroke-width 1.8`, round caps and joins, colour
from `currentColor` ("in the spirit of SF Symbols"). Default size 20; use **18** in buttons and rows, **16** in dense
controls. Decorative icons are `aria-hidden`; give a `title` only when the icon is the only label.

Names: `compose`, `chat`, `eye`, `bell`, `up`, `clock`, `plus`, `chevron`, `back`, `close`, `trash`, `pause`, `play`,
`refresh`, `edit`, `external`, `feedback`, `shield`, `sidebar`, `more`, `pin`, `archive`, `folder`, `copy`, `search`,
`restore`, `sun`, `moon`, `chart`, `check`, `camera`.

Rules: icons take `--text-2` at rest and `--text` on hover; `--accent` only when the control is active (tab bar);
`--danger` for destructive menu items; never `--tag`. Add an icon to `Icon.jsx` in the same style rather than importing
a set.

## 7. Components

| Component | Classes (styles.css) | File | Do | Don't |
|---|---|---|---|---|
| Button | `.button` (`:195`), `.primary`, `.tinted`, `.plain`, `.destructive`, `.danger-text`, `.wide`, `.large` | many | min-height 40px, `--radius-sm`, `--text-md` 500; one primary per view | more than one primary; coloured backgrounds other than the variants |
| Icon button | `.icon-button` 36px (`:212`), `.icon-button.small` 28px (`:217`) | `ThemeToggle.jsx` and others | `aria-label` and `title`; 44px tap area on touch (`:663`) | icon buttons without a label |
| Chip | `.chip` (`:218`) | `Composer.jsx` suggestions | pill, hairline, `--text-sm` | chips as primary actions |
| Listing card | `.listing` (`:438`), `.photo`, `.body`, `.title`, `.reason`, `.meta`; grid `.cards.grid` (`:436`) | `ListingCard.jsx` | the whole card is one link; floats with `--shadow`; hover lifts 2px | buttons inside the link |
| Alert item | `.alert-item` (`:983`) = card + rating row `.rate` (`:985`) | `AlertsView.jsx`, `RateAlert.jsx` | actions live below the card, not on it | — |
| Skipped card | `.listing.skipped` (`:450`) | `ListingCard.jsx` | `--bg`, no shadow, struck-through title in `--text-2`, photo at 45% | — |
| Score badge | `.score` (`:446`), `.great`, `.good`, `.low` | `ListingCard.jsx` | mono `9/10`; great = `--great`, good = `--good`, low = glass + hairline | colouring low scores red |
| Pill | `.pill` (`:500`) | page heads, beta | `--accent-soft` / `--accent` | more than one pill per header |
| Count badge | `.tabbar .badge, .new-count` (`:367`) | `Sidebar.jsx`, `TabBar.jsx` | accent fill, mono digits, "9+" cap | — |
| Grouped list | `.grouped` (`:482`) | Watches, Archived, settings | hairline dividers inset 16px; selected = `--accent-soft` | shadows on rows |
| Sheet | `.sheet` (`:503`), `.sheet-head`, `.sheet-body`, `.sheet-foot` | `Sheet.jsx` | native `<dialog>`; bottom sheet on phones with a grabber | stacking sheets |
| Feedback editor | `.fb-editor`, `.fb-timeline` | `views/admin/Views.jsx` | owner-only fields and chronological status entries inside the feedback drilldown | sending a drafted reply without an explicit press |
| Toast | `.toast` (`:323`) | `App.jsx` | inverted, `--great` check, short past-tense sentence | buttons in the toast (there is no undo system) |
| Tab bar | `.tabbar` (`:353`) | `TabBar.jsx` | phones only; glass; active in `--accent` | more than 4 tabs |
| Sidebar | `.sidebar` (`:236`), `.nav-item` (`:249`), `.nav-row`, `.dot` (`:260`) | `Sidebar.jsx` | active row `--fill-strong`; watch dot: filled = active, ring = paused; whole account row opens the menu, with an up chevron and `--fill` hover | — |
| Row menu | `.row-menu`, `.row-menu-trigger` (`:280`), `.menu` (`:290`) | `RowMenu.jsx`, `lib/actions.js` | destructive items need a second tap ("Delete for good?"); iOS action sheet on touch (`:663`) | one-tap delete |
| Proposal | `.proposal` (`:470`) | `Proposal.jsx` | lilac inset top bar = "the model proposes" | — |
| Composer | `.composer` (`:402`), `.mode-switch` (`:411`) | `Composer.jsx` | Watch mode turns the switch and send lilac | — |
| Field | `.field` (`:524`) | sheets | focus: accent border + 25% halo (`:530`) | — |
| Page header | `.page` (`:477`), `.page-head` (`:478`) | every page | h1 in `--display-s`, one intro line in `--text-2` | — |
| Empty state | `.empty-note` (`:190`) | lists | one plain sentence on what will appear and when | illustrations |
| Skeleton | `.skeleton` (`:976`) | `Skeleton.jsx` | static bars in `--fill` | shimmer on skeletons |

## 8. States

| State | How it looks | Where |
|---|---|---|
| Hover | `--fill` or `--fill-strong` background (buttons, rows, chips); cards lift 2px | `:200`, `:253`, `:442` |
| Focus | `:focus-visible` 3px `--focus` outline, offset 2px (`:174`); inside lists and menus an inset 2px ring; composer `--focus-ring` (`:408`); fields a soft halo (`:530`) | everywhere |
| Disabled | `opacity: 0.45`, default cursor (`:173`); the send button uses `--fill-strong` / `--text-3` | buttons |
| Busy | label changes to "…ing" ("Refreshing…", "Finding…"), control disabled, `aria-busy="true"`; status text shimmers while the AI works | dashboard refresh, Ask, chat |
| Selected / active | `--fill-strong` (nav), `--accent-soft` (grouped rows), `--accent` text (tab bar), `aria-current="page"` | sidebar, lists, tab bar |
| Error | `--danger` text in `--text-md` (`.error`); invalid field border `--danger`; error pages say what happened and offer Reload / Back | forms, `chunkRecovery` |
| Skipped | see `.listing.skipped` | watch page matches |
| Archived (shipped) | watches, chats and alerts: `archivedAt`, listed in `.grouped-row` on the Archived page with Restore (`restore` icon); toast "… archived. Find it under Archived." (`lib/actions.js`) | `ArchivedView.jsx` |
| New (shipped, MW-46) | `.alert-item.is-new` gives the card a 1px `--accent` ring and a soft `--accent-soft` halo alongside its `--shadow`, one settle on `--dur`/`--ease`, and a text pill "New" (`--accent-soft` background, `--accent` text, `--text-xs`). Visually hidden ", new" ends the card's accessible name. Lasts for that visit. | Alerts page |

## 9. Layout and breakpoints

- **Desktop (≥ 900px):** `.shell` = sidebar (`--sidebar-w` 272px) + scrolling `.main`. Pages max 960px wide
  (`.page`, `:477`); chat thread 760px; composer 720px.
- **Phone (< 900px):** `.shell.phone` = sticky glass top bar + content + fixed glass tab bar (Chat, Watches, Alerts,
  and Dashboard for the owner). Breakpoint rules at `:632` and `:849`; JS uses the same `(max-width: 899px)`.
  Listing grid becomes 2 columns; sheets become bottom sheets (`--radius-sheet` top corners).
- **Touch (`hover: none`, `:663`):** icon buttons and small buttons at least `--touch` (44px); row menus always visible
  and open as an action sheet.
- Safe areas: bars and sheets add `env(safe-area-inset-*)`.

## 10. Accessibility

**Contrast**, computed with WCAG 2.1 relative luminance (translucent colours composited over the surface they sit on).
Targets: text 4.5:1, UI parts 3:1.

| Pair | Light | Dark | |
|---|---|---|---|
| `--text` on `--bg` / `--elevated` / `--surface` | 16.66 / 17.39 / 14.63 | 15.20 / 12.93 / 14.03 | pass |
| `--text-2` on `--bg` / `--elevated` / `--surface` | 6.87 / 7.17 / 6.03 | 7.43 / 6.32 / 6.86 | pass |
| `--text-3` on `--bg` / `--elevated` / `--surface` | 5.15 / 5.38 / 4.52 | 5.59 / 4.75 / 5.15 | pass (4.52 is the tightest) |
| `--accent` on `--bg` / `--elevated` / `--surface` | 6.10 / 6.37 / 5.36 | 9.82 / 8.36 / 9.06 | pass |
| `--accent-ink` on `--accent` | 6.37 | 9.10 | pass |
| `--accent` on `--accent-soft` (over `--elevated`) | 5.50 | 6.26 | pass (pill, tinted button, planned "New") |
| `--tag-ink` on `--tag` (also good badge) | 11.38 | 8.76 | pass |
| `--great-ink` on `--great` | 5.88 | 8.99 | pass |
| `--danger-ink` on `--danger` | 6.57 | 7.30 | pass |
| `--danger` / `--warn` on `--bg` | 6.30 / 6.38 | 7.23 / 9.20 | pass |
| toast (`--bg` on `--text`) | 16.66 | 15.20 | pass |
| UI: `--accent` focus on `--bg` | 6.10 | 9.82 | pass |
| UI: `--great` dot on `--sidebar` | 5.26 | 10.49 | pass |
| UI: `--text-3` paused ring on `--sidebar` | 4.81 | 5.85 | pass |
| UI: `--tag` Watch-mode border on `--elevated` | **1.44** | 7.59 | fails as a boundary in light; acceptable only because Watch mode is also shown by the filled lilac switch with its text label |

Other rules:
- Colour is never the only signal (paused vs active dots differ in shape; scores show the number; "New" has a label).
- Every interactive element is reachable by keyboard with a visible focus (§8); the card link carries the focus ring.
- Touch targets at least 44px (`--touch`).
- Icon-only buttons have `aria-label` and `title`; live changes that matter use `role="status"` or `aria-live="polite"`.
- Reduced motion is honoured (§5).

## 11. Voice and microcopy

From `docs/marketing/references/brand-voice.md` and `docs/design/sieve/README.md:7-11`:
- The friend who knows how Marktplaats works: calm, practical, a bit dry; numbers beat adjectives; honest about limits.
- Sentence case everywhere. Contractions always ("you're", "don't").
- Buttons are a verb plus an object, three words or fewer ("Save watch", "Archive alert").
- No exclamation marks, no emoji, no em dashes in public copy; use a comma, full stop or colon.
- Never: instant, real-time, as soon as, be the first, never miss, guaranteed, AI-powered, revolutionary, seamless,
  "smart" as a claim; no hype, no urgency, no "DEAL!" badges, countdowns, fire or lightning icons, confetti.
- Formats: prices `€230` (no decimals, no space), scores `9/10`, times `08:00` (24-hour, Europe/Amsterdam).
- Toasts are short past tense with where to find the thing ("Watch archived. Find it under Archived.").
- Empty states say what will appear and when, in one sentence.

## 12. Changing the system

**Add or change a token**
1. Change it in all three blocks of `styles.css` where it has a theme value: light `:root`, the dark media block and
   `:root[data-theme="dark"]`. Theme-free tokens (type, space, radius, motion, layers) live only in `:root`.
2. Update the table in this file (same value, both themes).
3. Re-check contrast for any colour pair it affects (§10) and record the numbers.
4. Run the token check below; it must pass.

**Off-scale values.** Use the scales (space, radius, type). A literal outside them is allowed only for layout reasons
and must carry `/* off-scale: layout */` on the same declaration, so reviews can find them.

**One accent.** A new feature reuses `--accent`, `--accent-soft`, `--great`, `--danger`, `--warn` or the lilac tag for
its existing meanings. A new colour needs a written reason in this file first.

**New components** reuse an existing pattern from §7 (card, grouped list, sheet, row menu) before inventing one, and
document their states in §8.

**The check.** A script extracts every `--token: value` from the three blocks of `styles.css` and asserts each appears
with the same value in this file (`docs/design/DESIGN-SYSTEM.md`). Run it after any token change; the 1 Oct run passed
for all 131 token/value pairs (73 light, 29 dark by device, 29 dark by toggle).

## 13. Audit (1 October 2026)

What was compared: `frontend/src/styles.css` (1,011 lines) against `docs/design/sieve/tokens.css`, `tokens.json`,
`design-system.json`, `docs/design/sieve/components/*.md` (17 specs), `references/current-app-design-inventory.md`,
`docs/design/claude-design-brief.md` and `docs/system-design.html` §14. Values were extracted by script, not read by eye.

### Drift

| # | What | Where | Severity |
|---|---|---|---|
| 1 | `--z-toast` is `55` in the app, `70` in Sieve. In the app the toast sits under sheets (`--z-sheet: 60`), so a toast fired from inside a sheet is hidden behind it. | `styles.css:81` vs `sieve/tokens.css:82` | medium |
| 2 | Count badge radius is `--radius` (8px); the Sieve TabBar spec calls it a "Count pill". Looks fine at one digit; reads as a rounded square at "9+". | `styles.css:368` vs `sieve/components/TabBar.md:8` | low |
| 3 | `.pill` uses `--text-sm` 600; the Sieve Pill spec says `text-xs` 500, 24px high. | `styles.css:500` vs `sieve/components/Pill.md:5` | low |
| 4 | Four transitions use raw durations instead of tokens: `.button` 0.15s/0.1s, `.row-menu-trigger` 0.12s, `.mode-switch button` 0.2s. They still obey the global reduced-motion rule, but not the token switch. | `styles.css:198`, `:282`, `:414` | low |
| 5 | Two spacing literals off the scale without the marker: `.filter-chips .chip { padding: 4px 9px }` and `.admin-search-backdrop { padding: min(15vh, 100px) 16px 16px }`. One raw font size, marked (`.hello p` 16px, `:379`). Two raw radii, marked (`:521`, `:792`). | `styles.css:899`, `:901` | low |
| 6 | Two literal `rgba(0, 0, 0, 0.12)` shadows outside the tokens: the selected segment of the mode switch and of `.segmented`. | `styles.css:417`, `:739` | low |
| 7 | Light `--tag` as a boundary on `--elevated` is 1.44:1 (Watch-mode composer border). Covered by the labelled lilac switch, so not a blocker; don't rely on the lilac border alone anywhere else. | `styles.css:407` | low |
| 8 | Stale doc: the inventory still lists the pre-Sieve accent `#0071e3`/`#0a84ff` and amber `#f2a900` with "no dark value". | `references/current-app-design-inventory.md:4,21,24-25` | doc (marked superseded) |
| 9 | Stale doc: the Claude Design brief describes the old amber + blue palette as "today's app". | `docs/design/claude-design-brief.md:165` | doc (marked superseded; correct as history) |
| 10 | `tokens.css` has no `:root[data-theme="dark"]` block; the app added the toggle block (`:123-154`) after Sieve. Values match the media block exactly. | `styles.css:123-154` | none (documented here) |

Everything else matches: all 73 light tokens and all 29 dark tokens equal Sieve's values, apart from #1. The two dark
blocks in `styles.css` are identical. No hex colours appear outside the token blocks. There are 174
`/* off-scale: layout */` markers, almost all paddings in the shell, sidebar, chat and sheets.

### Verdict

The system is coherent and applied: one teal accent, one lilac highlight, a 6-step spacing scale, two fonts, motion
tokens with a reduced-motion switch, and passing contrast in both themes. Drift is small and mostly cosmetic. The real
gap was documentation: four overlapping documents, one of them describing the old palette. This file replaces them.

### Follow-ups (not done here; no app code was changed)

1. Raise `--z-toast` above `--z-sheet` (Sieve's `70`) so confirmations show over open sheets (#1).
2. Replace the four raw transition durations with `--dur-fast` / `--dur` (#4).
3. Mark or move the two unmarked spacing literals (#5).
4. Decide pill size and count-badge shape once, and update either the CSS or the Sieve specs (#2, #3).
5. Add the token check (§12) to CI so drift fails a build instead of waiting for an audit.
