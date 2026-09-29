# Marktplaats Watcher: current design system (28 Sep 2026)

Source of truth: `frontend/src/styles.css` (one file, no framework, no web fonts). The header comment states the intent:
"Apple-calm surfaces, ChatGPT-simple layout. The one loud element is the amber fill-in sentence. Light and dark follow
the device." Screenshots of the current app: `img/watcher-*.jpg` (dark mode, e-mail replaced).

## Tokens

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#ffffff` | `#212121` | page, sheets |
| `--sidebar` | `#f9f9f9` | `#171717` | desktop sidebar |
| `--surface` | `#f5f5f7` | `#2a2a2a` | user bubble, form groups, schedule box, sample rows, fields |
| `--elevated` | `#ffffff` | `#2f2f2f` | cards, composer, menus, proposal, grouped lists, chips |
| `--fill` | `rgba(118,118,128,.12)` | `rgba(118,118,128,.24)` | default button, hover, search bar, mode-switch track |
| `--fill-strong` | `rgba(118,118,128,.2)` | `rgba(118,118,128,.34)` | button hover, active nav row |
| `--line` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.09)` | every border and divider |
| `--text` | `#1d1d1f` | `#ececec` | primary text; send button; toast (inverted) |
| `--text-2` | `#6e6e73` | `#a1a1a6` | secondary text |
| `--text-3` | `#a1a1a6` | `#6e6e73` | tertiary text, placeholders |
| `--accent` | `#0071e3` | `#0a84ff` | links, primary button, focus ring, active tab |
| `--accent-ink` | `#ffffff` | (no dark value) | text on accent |
| `--accent-soft` | `rgba(0,113,227,.1)` | `rgba(10,132,255,.16)` | tinted buttons, pills, beta pill |
| `--tag` | `#f2a900` amber | (no dark value) | **signature-sentence highlight**, logo tile, Watch-mode composer, "good" score, proposal bar |
| `--tag-ink` | `#2b1d00` | (no dark value) | text on amber |
| `--great` | `#248a3d` | `#30d158` | score ≥8 badge, active-watch dot |
| `--good` | `#b25e00` | `#ffb340` | defined but unused |
| `--danger` | `#d70015` | `#ff453a` | destructive actions, errors |
| `--warn` | `#9a3b12` | `#ff9f6b` | a watch's last error |
| `--overlay` | `rgba(0,0,0,.32)` | `rgba(0,0,0,.55)` | dialog backdrop |
| `--glass` | `rgba(255,255,255,.78)` | `rgba(33,33,33,.78)` | phone top bar and tab bar, score badge |
| `--shadow` | `0 1px 2px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.08)` | `0 1px 2px rgba(0,0,0,.3), 0 12px 32px rgba(0,0,0,.4)` | floating surfaces |
| `--font` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, …` | | body |
| `--font-display` | `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", …` | | headings (letter-spacing -0.02em) |
| `--ease` | `cubic-bezier(0.32, 0.72, 0, 1)` | | all motion |
| `--radius` | `14px` | | cards, groups |

Missing today: spacing tokens (all spacing is literal px), font-size tokens, z-index tokens.

**Other radii:**
- 999px: buttons, chips, pills, badges
- 24px: composer
- 20px: sheet, user bubble
- 18px: touch menu
- 16px: phone sheet
- 12px: fields, toast
- 10px: nav items, selects
- 9px: mode switch
- 8px: menu items
- 28%: logo tile

**Type scale in use:**
- landing hero `clamp(34px,5.4vw,60px)`/700 at -0.03em
- chat h1 28–36px/600
- page h1 34px/700
- 20px lede, sheet titles
- 18px schedule sentence; selects 17px/700
- 17px primary list text
- 16px body and composer
- 15px buttons, nav, card titles
- 14px chips, menus, hints
- 13px pills, reasons
- 12px section labels
- 11px tab labels

Weights: 500, 600, 700.

**Motion:**
- menu 0.14s
- sheet 0.32s
- phone sheet 0.38s
- toast and card 0.2s
- landing highlight "tag-in" 0.45s
- logo "breathe" 1.6s
- status shimmer 1.8s

`prefers-reduced-motion` switches all of it off.

**Breakpoint:** phone below 900px (JS `useMediaQuery("(min-width: 900px)")`). `@media (hover: none)` turns menus into
iOS action sheets.

## Brand assets today

- **Logo:** the **🛒 emoji on an amber rounded tile** (`Logo.jsx`, radius 28%), not a real logo.
- **Favicon, app icons, manifest:** none.
- **OG image** (`frontend/public/og-image.png`, 1200×627): a *different* look from the app. It has a navy
  `#131a26` background, a geometric grotesk, amber highlights, the headline "Check Marktplaats for a [Mac mini under
  €500] [every morning at 8] and e-mail me the good ones." and two cards: 9/10 e-mailed, 0/10 docking station skipped.
- **Icons:** own inline SVG line set, 24px grid, stroke 1.8, round caps, "in the spirit of SF Symbols". 26 icons:
  compose, chat, eye, bell, up, clock, plus, chevron, back, close, trash, pause, play, refresh, edit, external, feedback,
  shield, sidebar, more, pin, archive, folder, copy, search, restore.

## Screens and signature components

- **Landing:**
  - Hero is a giant fill-in sentence with three amber highlighted choices that cycle every 3.2s: "Check Marktplaats for
    a [Mac mini with 16GB under €500] [every morning at 8] and e-mail me [good matches], with the reason."
  - Then the lede, a primary CTA "Set up a free watch", and "From a real check…" sample rows (9/10 green; 0/10 struck
    through and faded).
  - Then 3 steps and the privacy fine print.
  - The header (logo, name, Sign in) is sticky and frosted, so the logo stays on screen while scrolling (29 Sep).
- **Desktop app (ChatGPT style):** 272px sidebar with brand, search, New chat, Alerts, Pinned, Folders, Watches (green
  dot = active) and chats grouped by date, then Feedback & suggestions and the account row. The top block (brand,
  search, New chat, Alerts, Dashboard) and the account row are pinned; only the list between them scrolls (29 Sep).
- **Phone app (Apple style):** frosted top bar plus a frosted **tab bar** (Chat / Watches / Alerts, with a count of
  new alerts since 29 Sep); sheets slide up.
- **Composer:** rounded 24px box with a **"Search now | Watch it" segmented switch**. In Watch mode the border, selected
  segment and send button turn amber.
- **Listing card:** 4:3 photo, **score badge** (green ≥8, amber ≥6, glass otherwise), title, bold price plus place, the
  **reason** line, meta line.
- **Proposal card:** amber left bar, sentence, "Save watch" and "Adjust".
- **Schedule editor:** the sentence "Check Marktplaats [every hour ▾] and e-mail me [good matches ▾]", written with
  **amber select pills**, plus a help box explaining the notify level.
- **Watch page:** h1, the amber watch sentence, status line, Edit / Pause / Check now, a matches grid.
- **Other screens:** Watches, Alerts, Archived, onboarding (3-step sheet), privacy, feedback (with "Would you pay?"
  chips), menus, toast.

## E-mail (no brand today; since 29 Sep it follows the Sieve template)

- **Alert e-mail (before the restyle):** inline styles, `system-ui`, max-width 560px, one bordered card per listing with a blue link title,
  "Scored 9/10, €230, City", the reason, "Open on Marktplaats", and a grey footer. No logo, no brand colour.
- **Since 29 Sep:** the Sieve template: table layout (Outlook ignores flexbox), a dark-mode block, the logo, 40×48
  score badges, a teal "Open on Marktplaats" button, and "Good match? Yes · Not right" links without emoji.
  - Subject: "{watch}: {n} new match(es), best {score}/10 at €{price}".
- **Health digest:** plain `<pre>` monospace.

## Constraints any restyle must respect

- **CSP** (`vercel.json`):
  - `font-src 'self' data:`. **Google Fonts are blocked**, so fonts must be self-hosted (`next/font/local` or
    `public/`).
  - `style-src 'self' 'unsafe-inline'`; `img-src` limited to self, data, the Marktplaats image CDNs and Clerk.
- **Static export** (`output: "export"`), with an app shell that renders on the client.
- **Theme:** light and dark via `prefers-color-scheme` only. Every token needs a dark value; today `--tag`,
  `--tag-ink` and `--accent-ink` don't have one.
- **Clerk UI:** sign-in modal and user button, with default styling (an `appearance` prop can theme them).
- **Accessibility already in place:**
  - 3px accent focus ring
  - `aria` roles: radiogroup, menu, pressed
  - reduced motion
  - 44–48px touch targets
  - safe-area insets
- **Class names and attributes the CSS depends on** (keep them): `.active`, `.on`, `.open`, `.selected`, `.mode-watch`,
  `.returning`, `[aria-checked]`, `[aria-pressed]`, `.boot-landing`, `.boot-wait`.
- **Security headers:** the app refuses to be framed (`frame-ancestors 'none'`, `X-Frame-Options: DENY`). Phone
  mockups must be made at phone width, not by iframing the live site.
