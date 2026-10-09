> **Superseded (1 Oct 2026):** the current rules are in [docs/design/DESIGN-SYSTEM.md](DESIGN-SYSTEM.md). Kept as history.

# Design brief: Marktplaats Watcher

**For:** Claude Design (design language, visual style and a prototype logo), and then GPT Images (the final logo).
**Owner:** Daryl Nunes. **Written:** 28 Sep 2026.
**Scope:** cosmetic only. Every feature, flow, layout pattern and piece of copy stays; only the visual layer changes.
**Research behind it:** `references/` (Marktplaats' observed design, the current app inventory, the skill-pack and
course methods) and `docs/marketing/` (voice, avatar, competitors, allowed claims).

---

## 0. The prompt to paste into Claude Design

> You're designing the visual identity and design system for **Marktplaats Watcher**, a live web app. Read the whole
> brief below before designing.
>
> **Phase 1 (now): three distinct directions.** Give each a name. For each one, show:
> - 5 mood words
> - a light and a dark palette as named tokens (section 8 lists the names)
> - a type pairing of at most 2 fonts, self-hostable, with an open licence
> - a prototype logo: a symbol plus the full wordmark "Marktplaats Watcher"
> - three key screens:
>   - the landing hero, with the fill-in sentence
>   - the desktop chat, with two scored listing cards (9/10 e-mailed and 0/10 skipped)
>   - the alert e-mail
>
> Explain in one line per direction why it fits the brief, and where it takes a risk.
> Don't build the full system yet.
>
> **Phase 2 (after I pick):** the complete system for the chosen direction, as listed in section 13.
>
> Hard rules:
> - Keep every feature and layout: a ChatGPT-style sidebar on desktop, Apple-style tabs on phones, light and dark
>   following the device.
> - It must not resemble Marktplaats' own brand (section 6).
> - Use only the claims in section 12.

---

## 1. The product in one breath

**Promise:** "Only the new Marktplaats listings worth a look, each with a score and the reason, checked when you choose."
**Short form:** "Marktplaats alerts that read the listings first."

**How it works: three steps, one sentence.**
1. **Say it.** Type what you want in plain words ("Mac mini with 16GB under €500 near 3511AB"). The chat drafts a
   *watch*. The AI only **proposes**; you press **Save watch**.
2. **Pick when.** Choose any schedule in plain English, from every 15 minutes to weekly or at set times (Amsterdam
   time). Choose how picky it is:
   - great matches only (score 8–10)
   - good matches (6–10)
   - every new listing
3. **Get only the good ones.** Every *new* listing is scored from 0 to 10 with **one line on why**. Only the ones above
   your bar are e-mailed. The first check is silent: it just notes what's already listed.

There's also **Search now**, a one-off chat search with photo cards, next to **Watch it** in the same composer.

**What it deliberately is NOT:**
- not a deal-sniper ("speed is not our promise")
- not for resellers
- not a Marktplaats product (**not affiliated**)
- no push notifications: e-mail only
- no ads
- no subscription: free, up to 5 watches

**The single differentiator: the reason.** The competitors compete on speed; none of the alert sites we reviewed shows
a per-listing reason. It's "a capability, not a claim, verifiable in a demo" (FDE Day 3). The design must make *the
score plus the reason* the hero.

**Status:** a live portfolio MVP (https://marktplaats-watcher.vercel.app) built during Daryl's Forward Deployed
Engineer course. It's shared on LinkedIn and at a demo day on 3 Oct 2026.

## 2. Audiences, and how they should feel

**End user: "Joris", the specific-item hunter** (illustrative persona).
- **Who:** 31, hybrid office job, Utrecht. Wants a Mac mini 16GB for about €500, or a Gazelle bike. Earns fine but hates
  overpaying.
- **Before:**
  - irritated by noise ("half of it is junk")
  - a low-level fear of missing out
  - guilt about time spent scrolling
  - distrust of "random alert apps" and anything that looks like a scam using Marktplaats' name
- **After:** "one e-mail at 8 in the morning with two listings and a line saying why." He feels **calm, in control, a
  smart buyer again, not a compulsive scroller.**
- **Won't do:** another app that pings all day, a 12-field alert form, a subscription.

**LinkedIn: hiring managers, SME clients, FDE peers.** They ask "can this person take a messy real problem to a
working, safe product?" The desired perception is **"Daryl ships real, safe, honest AI products end to end."**
- **They're convinced by:** a real product, specifics, named limits, engineering judgement.
- **They're put off by:** hype, buzzwords, tutorial-clone looks, overclaiming.

**Design implication:** it should look **trustworthy, calm and precise**, like a well-made tool, not a marketing site.
Friendly, never cute. Confident, never loud.

## 3. Positioning, using the Marketing Engineer Agent Skill Pack

| Framework (source) | What it says for us | Design consequence |
|---|---|---|
| Market awareness, 03-strategist | Buyers are solution- to product-aware: they know alerts exist | Show the product and the mechanism right away; no abstract lifestyle imagery |
| Market sophistication, 03-strategist | Alert apps are at stage 3–4, where the **mechanism** differentiates | **Brand the mechanism.** The score badge + reason line is our most recognisable visual unit, and it should be ownable |
| Value Equation, 03-strategist | Raise perceived likelihood, lower effort | Proof in every hero: a real 9/10 card next to a 0/10 skipped one; the one-sentence setup shown as the input |
| Five Components / Law of Three, 03-strategist | A mechanism in three named steps | **Say it · Pick when · Get only the good ones** as a recurring 1-2-3 visual |
| Demonstrate / Before-after, 05-copywriter | The strongest proof device | A "docking station 0/10, skipped" vs "Mac mini 9/10, e-mailed" pairing, used on the landing page, OG image and LinkedIn |
| Recognition factor, 02-onboarding brand voice | "Every claim is concrete and every alert explains itself" | Numbers and reasons are set typographically with care: tabular figures, a clear hierarchy |
| Visual branding, 06-content-creator | 3–5 brand colours at most, 1–2 fonts, templates for recognition, "the visual must work on its own" | A small palette, a reusable card and badge language, and social templates |
| Four decisions, FDE course | One spacing scale, two fonts, one accent, real states | See section 10 |

## 4. Voice, turned into visual personality

**The voice:** "The friend at the dinner party who actually knows how Marktplaats works. Calm, practical, a bit dry.
Never sells, never hypes."
- **Always:** plain, concrete ("numbers beat adjectives"), honest about limits.
- **Never:** hype, corporate language, urgency or fear.

**Visual attributes:**

| Be | Avoid |
|---|---|
| calm, uncluttered surfaces | busy, dense, ad-like layouts |
| precise, with numbers treated as first-class | vague icon soup |
| explained: the reason is always visible next to the score | a score with no explanation |
| warm-neutral, human | sterile corporate blue, or cold "hacker" dark |
| confident with restraint: **one** loud element per screen | multiple competing highlights |
| trustworthy and independent | anything that looks like Marktplaats, or like a scammy "deal alert" app |

**Explicitly off-brand:** red "DEAL!" badges, countdowns, fire and lightning icons, confetti, neon gradients, stock
photos of happy shoppers, emojis as decoration, and the 🛒 emoji used as the logo today.

## 5. What's signature today (keep and evolve)

1. **The fill-in sentence.** "Check Marktplaats for a **[Mac mini with 16GB under €500]** **[every morning at 8]** and
   e-mail me **[good matches]**, with the reason."
   - The user's choices appear as **highlighted pills** inside a sentence.
   - It is the landing hero, the watch summary and the schedule editor, where the pills are dropdowns.
   - It's the product's signature line: design it as the brand's most recognisable pattern.
2. **Score badge plus reason line:**
   - badge colours: great (≥8), good (≥6), neutral below
   - the reason sits in one line under the price
3. **Search now | Watch it**, a segmented switch in the composer. Watch mode takes on the highlight colour.
4. **Calm layout:**
   - ChatGPT-style sidebar on desktop: New chat, Alerts, Pinned, Folders, Watches (with a status dot), chats by date,
     Feedback, account.
   - Apple-style frosted tab bar on phones: Chat / Watches / Alerts, with sheets that slide up.
5. **Light and dark**, following the device. The live demo runs in dark mode.

## 6. Competitive visual landscape, and what not to copy

**Marktplaats itself**, observed on 28 Sep 2026 (`references/marktplaats-design-language.md`):
- **Palette:** navy text `#2D3C4D`; action blue `#116DB4`; brand orange `#EDA566` (logo circle, top stripe, badges,
  banners); off-white `#FBFBFA`.
- **Logo:** an orange circle with a white arrow mark, then "Marktplaats" in the **Bree Serif** slab serif. Roboto for the
  body.
- **Feel:** dense, busy, many links, counts and flags, and **lots of ad space** ("Topadvertentie"). A "mac mini" search
  mixes in a Bluetooth tracker and auctions.
- **This is the noise we remove.** Our look should feel like the **calm, explained layer on top**, clearly *not*
  Marktplaats.

**Do not use:**
- an orange circle or an arrow/"z" mark
- an orange in the `#EDA566`–`#F2A900` family as the brand colour
- a slab serif
- a navy-text-plus-action-blue pairing
- a thin coloured stripe along the top edge
- heart-save icons, or ad-like flags and slots

Today's app already sits too close to Marktplaats: amber `#F2A900` plus blue `#0071E3`. **Move away from both.**

**Competitors:**
- **MPAlerts** (€19.95–39.95/month) is testimonial- and dashboard-led: "De slimste alerts", push, Telegram, a live
  dashboard with audio.
- **MarktAlert** (free trial, then €6.95–10.95) sells on speed and frequency.
- **Marktplaats' own saved search** is free and now advertises "Ook slim", with plain-language search.
- **None shows a reason per listing.** Stand apart as **calm and explained**, not faster or louder.

## 7. Name and logo

**The name stays "Marktplaats Watcher"** (the owner's decision). "Marktplaats" is a third party's trademark, so reduce
the risk through design:
- The wordmark's typography and colour must be clearly distinct from Marktplaats'. "Watcher" may carry more visual
  weight.
- The **symbol must work alone** (app icon, favicon) and must not reference Marktplaats' mark.
- A **"Not affiliated with Marktplaats"** line is part of the lockup system for the landing footer, the e-mail footer,
  the OG image and social templates.

**Concept seeds** (starting points, not requirements):
- watching or a lens
- a check-mark or reason mark
- the score ("9/10")
- a calm eye
- a pill or highlight shape echoing the fill-in sentence
- a shape suggesting "only the good ones get through" (a filter or sieve), which must still read at 16px

**Deliverables for the logo system** (prototype here; GPT Images refines the final, see section 16):
- symbol, full wordmark, horizontal and stacked lockups
- monochrome, and versions for light and dark backgrounds
- minimum sizes and clear space
- app icon: `favicon.svg`, 16/32 px, apple-touch 180×180, 512×512 maskable
- a replacement for the 🛒 emoji tile used in the sidebar, top bar and boot screen (the boot screen shows the logo
  gently "breathing" while the app loads)

## 8. The current system: restyle it one-to-one

The app uses these **CSS custom properties** (`frontend/src/styles.css`). Give new values for **every token, in both
light and dark**; today `--tag`, `--tag-ink` and `--accent-ink` have no dark value. Keep the names, so the change stays
cosmetic. You may add tokens, for example spacing and type scales, which don't exist today.

| Token | Role | Today (light / dark) |
|---|---|---|
| `--bg` | page, sheets | `#ffffff` / `#212121` |
| `--sidebar` | desktop sidebar | `#f9f9f9` / `#171717` |
| `--surface` | user bubble, form groups, schedule box | `#f5f5f7` / `#2a2a2a` |
| `--elevated` | cards, composer, menus | `#ffffff` / `#2f2f2f` |
| `--fill`, `--fill-strong` | neutral buttons, hover, active row | grey 12% / 20% (dark 24% / 34%) |
| `--line` | borders, dividers | black 8% / white 9% |
| `--text`, `--text-2`, `--text-3` | text ramp | `#1d1d1f` `#6e6e73` `#a1a1a6` / `#ececec` `#a1a1a6` `#6e6e73` |
| `--accent`, `--accent-ink`, `--accent-soft` | links, primary buttons, focus ring, active tab | `#0071e3` / `#0a84ff` |
| `--tag`, `--tag-ink` | **the highlight**: fill-in sentence pills, Watch mode, "good" badge, proposal bar, logo tile | `#f2a900` on `#2b1d00` |
| `--great` | score ≥8, active-watch dot | `#248a3d` / `#30d158` |
| `--good` | score 6–7 (currently unused; the badge uses `--tag`) | `#b25e00` / `#ffb340` |
| `--danger`, `--warn` | destructive actions, a watch's error | `#d70015`, `#9a3b12` |
| `--overlay`, `--glass`, `--shadow` | dialog backdrop, frosted bars, floating surfaces | |
| `--font`, `--font-display` | body and headings | system (SF Pro, Inter fallback) |
| `--radius` | cards | 14px; others: pills 999px, composer 24px, sheets 20px, fields 12px |
| `--ease` | all motion | `cubic-bezier(0.32,0.72,0,1)` |

**Type in use today:**
- landing hero 34–60px/700
- h1 34px
- lede 20px
- body 16px
- card title 15px
- reason 13px
- tab labels 11px

**Icons:** own 24px line set, stroke 1.8, round caps (26 icons). Keep it or specify a matching replacement.

**The CSS depends on these state hooks; styles may change but the names stay:** `.active`, `.on`, `.open`,
`.selected`, `.mode-watch`, `[aria-checked]`, `[aria-pressed]`, `.returning`, `.boot-landing`, `.boot-wait`.

## 9. Screens and states to cover

Real copy is quoted. Use it and don't invent new copy.

| Surface | Key content | States |
|---|---|---|
| **Landing** (signed out) | The fill-in sentence hero, which cycles 3 examples. Lede: "Say what you want in plain words. Pick when to check. We read every new listing, score it 0 to 10 and say why. Only the ones worth a look reach your inbox. Free, up to 5 watches." CTA "Set up a free watch"; note "No card, no app to install." "From a real check for 'Mac mini, 16GB, under €500'" sample rows: 9/10 kept, 0/10 "A docking station, not a Mac mini. You never hear about it." Three steps. Fine print "What we keep, and for how long" + not-affiliated line | prerendered, no loading screen |
| **Boot** | The logo, breathing | returning users |
| **Desktop sidebar** | brand, search (⌘K), New chat, Alerts, Pinned, Folders +, Watches + (dot active or paused, schedule under the name), chats by date, "Feedback & suggestions", account row, shortcuts line | hover "…" row menus |
| **Phone** | frosted top bar, frosted tab bar (Chat / Watches / Alerts, badge count), bottom sheets with a grabber | |
| **Chat, empty** | "What are you looking for?" · "Search Marktplaats in plain words, or switch to Watch it to get the good new ones by e-mail." Composer with the Search now / Watch it switch, suggestion chips ("Search · Mac mini 16GB under €500", "Watch · Gazelle bike near 3511AB, every morning at 8"), "Free beta · Give feedback & suggestions" | |
| **Chat, thread** | user bubble, streamed answer, horizontal row of **listing cards**, proposal card ("Save watch" / "Adjust"), "Watch this search" | status "Thinking…", "Drafting a watch for you to check…"; errors: "The chat can't reach its AI right now. Try again in a few minutes." |
| **Listing card** | 4:3 photo, **score badge**, title (2 lines), **€230** + place, **reason**, meta | no photo |
| **Watch sheet and schedule editor** | settings-style form (Item, Title includes, Max price, Near postcode, Within), then the sentence "Check Marktplaats [every 15 minutes ▾] and e-mail me [good matches ▾]" with **highlighted select pills**, help text "Scores 6–10: also decent options, like an older model or a price near your limit. Catches the most real matches." | |
| **Watch page** | h1, the watch sentence with highlighted pills, "Next check today at 10:04 · last checked today at 09:49", Edit / Pause / Check now, Matches grid | empty: "No new matches yet. When a check finds a good one, we'll e-mail you."; error line |
| **Watches / Alerts / Archived** | grouped lists; Alerts is a card grid | "Nothing watched yet…", "No alerts yet…" |
| **Onboarding** | 3-step sheet with a progress bar: "What should we keep an eye on?" → schedule → recap → "Start watching" | |
| **Privacy, Feedback** | text sheet with "Delete my data" (destructive confirm); feedback textarea and "Would you pay for this?" chips (No / Maybe / €2 / €5 / €10+ a month) | |
| **Menus, toast, dialogs** | "…" menus (popover on desktop, action sheet on touch), toast "Thank you. Daryl reads every message." | |
| **Clerk sign-in modal** | third-party; can be themed with colours, radius and font | |
| **Alert e-mail** | Subject "Mac mini, 16GB, under €500: 2 new matches, best 9/10 at €230". One card per listing: title link, "Scored 9/10, €230, Utrecht", reason, "Open on Marktplaats"; footer "Manage or pause this watch", "Replies to this address aren't read.", not affiliated | inline CSS only, no web fonts, light and dark safe, max 560px |

## 10. System rules (FDE course + accessibility)

- **Spacing:** one scale, 4/8/16/24/32/48 ("never 13 or 27"). Define it as tokens.
- **Fonts:**
  - At most **two**; one may be the system font.
  - Must be **self-hostable** with an open licence (SIL OFL or similar). The site's security policy blocks Google Fonts
    CDNs (`font-src 'self'`).
  - Tabular figures for scores and prices.
- **Colour:**
  - one **accent** plus one **highlight** (the fill-in pills)
  - a neutral ramp
  - semantics: great, good, danger, warn
  - **3–5 brand colours at most**
- **Contrast:** 4.5:1 for text (3:1 for large text and UI) in **both** light and dark. Provide a contrast table.
- **Focus:** a visible focus ring (currently 3px accent).
- **Motion:** subtle, respects reduced motion. Today's motions to keep: sheet up, menu fade, highlight fade-in on the
  landing, logo breathing on the boot screen.
- **Touch:** targets of 44–48px; safe-area insets on phones.
- **Breakpoint:** desktop layout at 900px and up; phone below.
- **Mockups:** phone mockups at 390px. The live site can't be iframed (security headers).

## 11. Brand applications beyond the app

- **OG image**, 1200×627. It replaces today's navy version, which doesn't match the app. Content: logo, the fill-in
  sentence, the 9/10 vs 0/10 pair, the not-affiliated line.
- **LinkedIn:**
  - post image 1200×627
  - carousel of 7–12 slides at 1080×1350; slide 1 must work on its own; bold type of at least 24pt; numbered "3/10"
  - **stat card** (e.g. "19/20 chat test cases passed (9 Oct 2026 report)")
  - before/after card (0/10 skipped vs 9/10 e-mailed)
  - simple architecture or process graphic (Say it · Pick when · Get only the good ones)
- **Favicon and app icons**, as in section 7.

## 12. Claims guardrails (for every mockup)

**Allowed, with their exact qualifiers:**
- "Great-match precision 100% and recall 78% (median of 3 runs) on 53 listings from 6 watches (9 Oct 2026 report)"
- "19/20 chat test cases passed (9 Oct 2026 report)"
- "An hourly watch finding one new listing an hour costs about €0.33 a month in AI cost (9 Oct 2026 report)"
- "Free, up to 5 watches"
- "Scores every new listing 0 to 10 and says why"
- "Checks from every 15 minutes, Amsterdam time"

**Never use:** instant, real-time, as soon as, be the first, never miss, guaranteed, AI-powered, revolutionary,
seamless, smart (as a claim); invented testimonials, user counts or ratings; exclamation marks; emojis in the product
or e-mail.

**Formats:**
- prices "€230" (no decimals, no space)
- scores "9/10"
- times "08:00", 24-hour
- sentence case
- buttons: a verb plus an object, three words at most

## 13. What to deliver in Phase 2 (the chosen direction)

1. **Tokens:** every section 8 token plus new spacing and type-scale tokens, as a CSS `:root` block plus a
   `@media (prefers-color-scheme: dark)` block, ready to paste.
2. **Typography:**
   - font names, weights, files and licence
   - type scale: at most 5 sizes for UI, plus display
3. **Component specs:** buttons (primary, tinted, plain, destructive, default), chips, pills, segmented switch, score
   badge (great/good/neutral), listing card, proposal card, fill-in sentence pills, schedule selects, grouped list rows,
   sidebar rows, tab bar, sheet, menu, toast, fields. Each with states: hover, focus, pressed, disabled, selected.
4. **Key screens** in light and dark: landing, desktop chat thread, phone watch page, watch sheet, alert e-mail.
5. **Logo prototype:** symbol, wordmark, lockups, app icon set, in SVG where possible.
6. **E-mail HTML pattern:** inline styles, safe in dark mode.
7. **OG and LinkedIn templates** from section 11.
8. **Accessibility contrast table** for all text and UI colour pairs, light and dark.
9. **Icon guidance:** keep the 1.8-stroke line set, or specify a replacement set with an open licence covering the 26
   names in `references/current-app-design-inventory.md`.

## 14. Non-goals

- No new features, flows, screens or navigation changes.
- No copy rewrite: use the strings above.
- No web fonts loaded from third-party CDNs.
- No stock photography or AI-generated people.
- No Marktplaats look-alike (section 6).
- Not a marketing-site redesign: the landing keeps its current structure.

## 15. Open questions for Daryl (don't block the design)

1. How much weight should "Marktplaats" carry in the wordmark versus "Watcher"? The name is fixed, but the emphasis is
   a design choice.
2. Should the demo lean dark-first (the demo runs in dark mode) or keep light and dark equal?
3. Does Daryl want a personal signature element (e.g. "by Daryl Nunes") in the lockup for LinkedIn assets?

## 16. Logo pipeline: the GPT Images refinement prompt

Claude Design makes the prototype. **GPT Images refines the final logo.** Fill in the `[…]` values from the chosen
direction and attach the prototype PNG as the reference image:

> Refine the attached logo prototype into a final, production-quality logo for **"Marktplaats Watcher"**, a calm,
> trustworthy web app that watches second-hand listings and e-mails only the good ones, each with a score and a
> one-line reason.
>
> Keep:
> - the concept of the attached symbol: [describe the mark, e.g. "a rounded lens with a check-mark inside"]
> - the wordmark text exactly: "Marktplaats Watcher"
> - the palette: [primary #……], [highlight #……], [ink #……]
> - the typeface feel: [e.g. "humanist sans, medium weight"]
>
> Style:
> - flat vector, clean geometric construction, even stroke weights, no gradients, no 3D, no textures
> - generous clear space, perfectly centred on a transparent background
>
> It must read clearly at 16×16 px as a favicon. Deliver it in this order:
> 1. the symbol alone, full colour
> 2. the symbol alone, one colour black
> 3. the symbol alone, one colour white on dark
> 4. the horizontal lockup, symbol + wordmark
>
> Avoid:
> - orange circles, arrow or "z" shapes
> - slab-serif lettering
> - navy with bright blue
> - shopping carts, price tags, lightning bolts, fire, hearts
> - any resemblance to the Marktplaats logo
>
> Friendly but not cute; confident, not loud.

Afterwards, the chosen raster logo is **re-vectorised to SVG** before it goes into the app. The raster is kept only as
the reference.

## Sources

- **Product and marketing:** `docs/marketing/references/brand-voice.md`, `…/onboarding.md`, `…/research.md`;
  `docs/marketing/generated/buyer-avatar.md`, `…/in-app-copy.md`, `…/linkedin-audience.md`, `…/validation.md`;
  `docs/marketing/competitors/*.md`; `docs/demo/demo-script.md`; `evals/report.md`.
- **Current app:** `frontend/src/styles.css`, `frontend/src/components/*`, `frontend/src/Landing.jsx`,
  `frontend/convex/checker.ts` (`renderEmail`), `vercel.json`.
- **Research:** `references/marktplaats-design-language.md`, `references/current-app-design-inventory.md`,
  `references/brand-and-design-methods.md`.
