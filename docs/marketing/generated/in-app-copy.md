# In-App Copy Deck — Marktplaats Watcher

> Built with `05-copywriter` as the method (translated from Dutch), plus the `03-strategist` avatar/funnel lens for the
> message hierarchy, `02-onboarding /brand-voice` output, `06-content-creator` plain-language writing rules,
> `10-product-builder` validation and `09-seo-specialist` for title/meta/H1 only.
> Inputs: `references/brand-voice.md`, `references/research.md`, `generated/buyer-avatar.md`,
> `generated/validation.md`, `competitors/*`, and every user-facing string in `frontend/src`, `frontend/convex`,
> `main.py` and `agent.py` as of 2026-09-27 (branch `wave1-demo-ready`, commit 9902222).
>
> **Scope:** copy only. No new features. Where a recommendation needs a small code change beyond swapping a string,
> the Why column says so. Items that need Daryl's call are marked `[DARYL: …]`.
> **Status:** Draft. Nothing here has been user-tested.

---

## 1. Message hierarchy (end user: Joris, the specific-item hunter)

### Primary promise
**Only the new Marktplaats listings worth a look, each with a score and the reason, checked when you choose.**

Short form for UI and meta: *"Marktplaats alerts that read the listings first."* (validation.md pitch, kept.)

### Three proof points (in the order the page should show them)
1. **Demonstration, from a real check.** Searching "mac mini" returned docking stations, SSDs, a tracker and a Cisco
   switch: all scored 0/10, none e-mailed. The real Mac mini (i5, 16GB, €230) scored 9/10 and was e-mailed.
   (Bencivenga #1 Demonstration + #4 Specifics, `proof.md`.)
2. **Every alert explains itself, and you set the bar.** Score 0 to 10 plus a one-line reason on every new listing.
   You choose great matches only (8+), good matches (6+) or every new listing. Nobody in the category shows the reason
   (research.md comparison table: MPAlerts "not shown on the site", MarktAlert "no").
3. **Your schedule, honest terms.** Every 15 or 30 minutes, every 1, 3, 6 or 12 hours, daily at up to 4 times, or on
   chosen weekdays. The first check stays silent so you only hear about new listings. Free, up to 5 watches, 30-day
   retention, one-click delete, not affiliated with Marktplaats. (Bencivenga #11 Candor.)

### Top 5 objections and the answering line
Source: buyer-avatar.md §12D; handling per `proof.md` "Five Universal Objections" + "Preemptive Objection Handling"
and `salespage-systeem.md` §12 (FAQ: question, then a direct, honest answer).

| # | Objection (inner voice) | Universal type | Answering line (use as-is) |
|---|---|---|---|
| 1 | "Why not just save the search on Marktplaats?" | No need | "A saved search sends what matches the words. This reads each new listing first and only sends the ones that fit, with the reason." |
| 2 | "Every 15 minutes at best? The good ones are gone in 5." | No need / no hurry | "It isn't the fastest alert, and doesn't try to be. It's for knowing which listing is worth a message. Check every 15 minutes, or once a morning." |
| 3 | "Who's behind this? Is it a scam using Marktplaats' name?" | No trust | "A free portfolio project by Daryl Nunes, not affiliated with Marktplaats. No card, nothing to pay. Alerts come from marktplaats-watcher@agentmail.to." `[DARYL: OK to put your name on the landing page?]` |
| 4 | "Will the AI hide a good listing from me?" | No trust | "You set the bar. Pick 'every new listing' and you get all of them, still scored, with the reason." |
| 5 | "It's a student project. Will it still work next month?" | No trust | "Nothing to cancel and nothing to pay. Delete your data in one tap whenever you're done." |

### Awareness level of a first-time visitor (`leads.md` Five Stages + Matching Leads to Awareness)

| Source | Stage | Why | Lead type the page must serve | What they need above the fold |
|---|---|---|---|---|
| **LinkedIn** (Daryl's post, e.g. "it found me a Cisco switch") | **Problem-aware** for the product (and often not an end user at all: hiring managers, peers) | They arrive from a story, not a need. They know the noise problem only because the post told them. | Story → Problem-Solution. The post already did the story; the page must *continue it*: the same Mac mini example, visibly. | The sample block (9/10 vs 0/10) in the first screen, one sentence on how it works, one CTA. |
| **Google** (queries like "marktplaats alert", "marktplaats melding instellen") | **Solution-aware**, sliding into product-aware (research.md "Market Awareness") | They know saved searches and alert apps exist and are comparing. Market sophistication 3 to 4: "get notified" is claimed by everyone. | Promise lead + mechanism (`frameworks.md` Market Sophistication L3/L4: show *how* it works differently). | The differentiator in the first two lines: reads the listing, scores it, says why, on your schedule, free. |

One page serves both, so the hero follows the Google visitor (promise + mechanism in the H1 and lede) and the sample
block directly below serves the LinkedIn visitor (the story they just read, as proof). Note: the page is English, so
Dutch-language searches will rarely land here. `[DARYL: do you want search traffic from end users at all, given the
ToS art. 7.3 exposure in research.md? If not, keep SEO minimal and optimise for LinkedIn visitors only.]`

### The one differentiator vs Marktplaats' own saved search
**The reason.** Marktplaats' saved search matches the words you typed and is reported to e-mail a daily overview; it
has no relevance score and no explanation (research.md comparison table; competitors/marktplaats-saved-search.md).
Watcher reads every new listing, scores it 0 to 10, says why in one line, and only e-mails the ones over the bar you
picked, on the schedule you picked. Lead with the reason; the schedule is the supporting fact.
Do not claim "Marktplaats only e-mails once a day" in public copy: that is reported by users and interested
competitors, not verified (push behaviour is contested). `[DARYL: test the native saved search once and screenshot it
before any copy compares frequency.]`

---

## 2. Copy deck per surface

Legend: **Keep** = current copy already fits; no change needed. Recommended copy is English, sentence case, no em
dashes, no emojis. `{x}` = variable.

### 2.1 Page title, meta, Open Graph — `frontend/app/layout.jsx`

| Location | Current | Recommended | Why |
|---|---|---|---|
| `metadata.title` | Marktplaats Watcher | Marktplaats alerts that say why \| Marktplaats Watcher (53 chars) | `09-seo-specialist/knowledge-base/technische-seo.md` §1: ≤60 chars, main keyword first, `[keyword] [value] \| [brand]`. The brand alone has no promise. Pipe instead of the SEO formula's em dash (writing-rules.md: no em dashes). |
| `metadata.description` | Marktplaats alerts that read the listings first: say what you want, pick when to check, and get only the good ones, each with a reason. (135) | Marktplaats alerts that read the listings first. Say what you want, pick when to check, and get only the good ones, each with a reason. Free. (141) | SEO SKILL.md: ≤155 chars, keyword + CTA/offer. "Free" is the strongest provable hook against paid competitors (validation.md "Different price"). |
| `openGraph.title` | Marktplaats Watcher | Marktplaats alerts that read the listings first | Social cards show `siteName` already; the title slot should carry the promise (`leads.md`: 8 of 10 read only the headline). |
| `openGraph.description` | Say what you want, pick when to check, and get only the good listings, each with a score and the reason for it. | **Keep** | Plain, concrete, no hype (brand-voice "Always: plain, concrete"). |
| `openGraph.images[0].alt` | Check Marktplaats for a Mac mini under €500 every morning at 8 and e-mail me the good ones. A 9/10 match is e-mailed, a 0/10 docking station is skipped. | **Keep** | Describes the image and doubles as demonstration. |
| `<html lang>` | en | **Keep** | Page is English. |

### 2.2 Landing — `frontend/src/Landing.jsx`

| Location | Current | Recommended | Why |
|---|---|---|---|
| Header button | Sign in | **Keep** | Returning users look for exactly this word. |
| `h1.sentence` (rotating) | Check Marktplaats for a {Mac mini with 16GB under €500} {every morning at 8} and e-mail me {good matches}. | Check Marktplaats for a {Mac mini with 16GB under €500} {every morning at 8} and e-mail me {good matches}, with the reason. | Four U's (`leads.md`): current scores Useful 4, Ultra-specific 4, Unique 2, Urgent 1 (urgency is off-brand by choice). Adding "with the reason" lifts Unique: it names the one thing no competitor shows. Keeps the voice signature fill-in sentence (brand-voice "Catchphrases"). SEO: one H1 containing "Marktplaats" (technische-seo.md §3). |
| `EXAMPLES` rotation | Mac mini with 16GB under €500 / every morning at 8 / good matches; Gazelle bike within 10 km of 3511 / every 30 minutes / every new listing; Nintendo Switch OLED under €200 / on Fridays at 18:00 / great matches only | **Keep** | Real items, real times, real postcodes: exactly the "Alleen Jij" specifics (writing-rules.md §2) and brand-voice storytelling style. |
| `p.lede` | Say what you want. Pick when to check. Every new listing gets a score from 0 to 10 and the reason for it, and only the ones worth a look reach your inbox. Free. | Say what you want in plain words. Pick when to check. We read every new listing, score it 0 to 10 and say why. Only the ones worth a look reach your inbox. Free, up to 5 watches. | Shows the *mechanism* ("we read"), which sophistication level 3 to 4 requires (`frameworks.md` Market Sophistication). Splits the 30-word sentence (writing-rules.md "one sentence = one job"). "Up to 5 watches" is Candor next to "Free" (Bencivenga #11). |
| Primary CTA | Sign in to start watching | Set up a free watch | `salespage-systeem.md` §11: CTA text is action-specific and names the gain, not the friction. `frameworks.md` AIDA: single CTA per context. "Sign in" stays in the header for returning users. |
| Under CTA (new line, small) | (none) | No card, no app to install. Sign in with your e-mail. | Pre-empts objections 3 and 5 at the moment of action (`proof.md` Preemptive Objection Handling). `[DARYL: confirm the Clerk sign-in methods; if Google sign-in is on, use "Sign in with e-mail or Google."]` Needs one `<p>` in Landing.jsx. |
| `#sample-title` | From a real check for "Mac mini, 16GB, under €500" | **Keep** | Specific, true, sets up the demonstration. |
| Sample row 1 (9/10) | **Apple Mac mini, Intel Core i5, 16 GB RAM, 512 GB**, €230 / A Mac mini with 16GB and a price well under €500. E-mailed. | **Keep** | Real listing, real reason, real outcome. |
| Sample row 2 (0/10) | **Mac Mini M4 Docking Station 1TB**, €74 / A docking station, not a Mac mini. You never hear about it. | **Keep** | The contrast is the whole product in one line. |
| Sample row 3 (new, 0/10) | (none) | **Also found: SSDs, a tracker and a Cisco switch** / All scored 0/10. None e-mailed. | The Cisco switch is the brand's best dry-humour fact (brand-voice "Humor: from the facts") and the LinkedIn launch story; a LinkedIn visitor should see the same example on arrival (message match). `[DARYL: confirm these came from the same check as the €230 Mac mini. If not, retitle the block "From real checks for a Mac mini".]` |
| Step 1 | **Tell the chat what you want.** "A Mac mini with 16GB, under €500, near Utrecht." | **Keep** | Concrete example in the user's words (avatar §8: "let me just say it"). |
| Step 2 | **Pick how often to check.** Every 15 minutes, every morning at 8, or only on weekends. | **Pick when to check.** Every 15 minutes, every morning at 8, or only on weekends. | "When" matches the lede and the schedule editor, which offers times and days, not only frequency. |
| Step 3 | **Get an e-mail when a good one appears.** The first check only notes what's listed now, so you only hear about new ones. | **Get an e-mail when a good one appears, with the reason.** The first check only notes what's listed now, so you only hear about new ones. | Repeats the differentiator at the last step before fine print (`frameworks.md` Golden Thread: tie every block back to the benefit). |
| Fine print `h2` | What we keep, and for how long | **Keep** | Brand-voice catchphrase. |
| Fine print ¶1 | Your e-mail address (to send alerts), your watches, and the listings we've already shown you, for 30 days. Searches and listing titles are sent to OpenAI to score them. Nothing else, and nothing is sold or shared. "Delete my data" in the app removes it all at once. | Your e-mail address and your watches, until you delete them. Your chats and the listings we've checked, for 30 days. Your messages, searches and listing details are sent to OpenAI to answer and score them. Nothing is sold or shared. "Delete my data" in the app removes it all at once. | **Accuracy fix.** `checker.ts purgeOld` deletes seen listings, alerts and untouched chats after 30 days; users and watches are not purged. Current copy implies the e-mail address and watches expire at 30 days and omits chats and chat messages going to OpenAI. (Bencivenga: "never make your claim bigger than your proof"; brand-voice "honest about limits".) `[DARYL: confirm listing descriptions are not sent to OpenAI; rank_listings sends the parsed listing object.]` |
| Fine print ¶2 | Up to 5 watches per person, checked at most every 15 minutes. It reads the first page of Marktplaats' public search results, so it's for watching, not for searching everything. | **Changed 29 Sep:** Up to 5 watches per person, checked at most every 15 minutes. Each check reads every listing placed since the last one, with your price and distance applied by Marktplaats. A search in the chat shows the first page of results. | "First page only" stopped being true for watches on 29 Sep (system design §16); it is still true for the chat. |
| Fine print ¶3 | A portfolio project, not affiliated with Marktplaats. Alerts come from marktplaats-watcher@agentmail.to. | A free portfolio project by Daryl Nunes, not affiliated with Marktplaats. Alerts come from marktplaats-watcher@agentmail.to, so add it to your contacts. | A named person answers objection 3 (`proof.md` "Highly Believable Source"). The contacts tip reduces missed alerts from an unfamiliar domain. `[DARYL: name on the page, yes/no.]` |

**Optional Dutch hero (secondary, landing only)** `[NEEDS NATIVE CHECK]`

| Element | English (recommended) | Dutch option `[NEEDS NATIVE CHECK]` |
|---|---|---|
| H1 | Check Marktplaats for a Mac mini with 16GB under €500 every morning at 8 and e-mail me good matches, with the reason. | Check Marktplaats op een Mac mini met 16GB onder €500, elke ochtend om 8 uur, en mail me de goede, met de reden. |
| Lede | Say what you want in plain words. Pick when to check. We read every new listing, score it 0 to 10 and say why. Only the ones worth a look reach your inbox. Free, up to 5 watches. | Zeg in gewone woorden wat je zoekt. Kies wanneer we kijken. We lezen elke nieuwe advertentie, geven een cijfer van 0 tot 10 en zeggen waarom. Alleen de advertenties die het bekijken waard zijn, komen in je inbox. Gratis, tot 5 zoekopdrachten. |
| CTA | Set up a free watch | Stel een gratis melding in |

Note: "melding" is the market's own word (research.md buzz words, 7 sources). `[DARYL: Dutch landing now, later, or never?]`

### 2.3 Sign-in — Clerk modal (not in repo copy)

| Location | Current | Recommended | Why |
|---|---|---|---|
| Clerk sign-in modal heading/subtitle | Clerk defaults ("Sign in to Marktplaats Watcher", "Welcome back! Please sign in to continue") | Heading: Sign in to Marktplaats Watcher. Subtitle: Alerts go to this e-mail address. | Default "Welcome back!" is wrong for first-time visitors and uses an exclamation mark (brand-voice "Never: hype"). The subtitle explains *why* an e-mail is needed. Optional: set via Clerk `localization`. `[DARYL: worth customising Clerk?]` |

### 2.4 Onboarding — `frontend/src/views/Onboarding.jsx`

| Location | Current | Recommended | Why |
|---|---|---|---|
| Sheet title | Set up your first watch · 1 of 3 | **Keep** | Progress + goal in one line. |
| Step 1 lead | What should I keep an eye on? | What should we keep an eye on? | Voice rule: "I" is the chat only; the product speaks as "we" (Alerts page, privacy, e-mail already do). |
| Step 1 input placeholder | e.g. Mac mini | **Keep** | |
| Step 1 idea chips | Mac mini / Gazelle bike / Nintendo Switch OLED / IKEA Pello chair | **Keep** | Real, varied, avatar-true items. |
| Step 1 price placeholder | Max price in € (optional) | **Keep** | |
| Step 2 lead | How often should I check? | When should we check, and what should we send you? | Step 2 contains the schedule *and* the notify level; the current lead only describes half of it. |
| Step 3 lead | Alerts go to **{email}**. | Alerts go to **{email}**, from marktplaats-watcher@agentmail.to. | Unknown sender domain; saying it here prevents "where's my e-mail?" later. |
| Step 3 sentence | Checking Marktplaats for {query} {schedule}, e-mailing you {notify}. | **Keep** | Signature sentence as the confirmation (brand-voice "Recognition Factor"). |
| Step 3 hint | The first check only notes what's listed now, so you only hear about new ones. | **Keep** | Candor at the moment it matters. |
| Footer buttons | Skip / Back / Continue / Start watching / Saving… | **Keep** | Verb-first, short. "Start watching" is the right final CTA. |

### 2.5 Empty chat, suggestions, composer, status — `ChatView.jsx`, `Composer.jsx`, `agent.py status_for()`

| Location | Current | Recommended | Why |
|---|---|---|---|
| `.hello h1` | What are you looking for? | **Keep** | The avatar's own question. |
| `.hello p` | Search Marktplaats in plain words, or ask me to keep an eye on something. | Search Marktplaats in plain words, or switch to Watch it to get the good new ones by e-mail. | Names the switch the user sees right below and what it does. Currently nothing explains "Watch it". |
| Suggestion chips | [Search] Mac mini 16GB under €500 · [Watch] Gazelle bike near 3511AB, every morning at 8 · [Watch] Nintendo Switch OLED under €200, only great matches | **Keep** | One search, two watches, each showing a different option (distance, schedule, bar). |
| Mode switch | Search now \| Watch it | **Keep** | Clear verbs, radiogroup label "What should happen" is fine. |
| Placeholder, search | Search Marktplaats, e.g. Mac mini 16GB under €500 | **Keep** | |
| Placeholder, watch | What should I watch? e.g. Gazelle bike near 3511AB, every morning at 8 | What should I watch, and when? e.g. Gazelle bike near 3511AB, every morning at 8 | Without a time the agent silently defaults to every 60 minutes (`WATCH_MODE`). Asking "and when" gets the schedule in the first message. ("I" is correct here: this is the chat.) |
| Live status, search start | Thinking… | **Keep** | Familiar, brief. |
| Live status, watch start | Setting up a watch… | Drafting a watch for you to check… | Nothing is saved until the user presses Save (SYSTEM_PROMPT: "never say a watch is saved"). "Setting up" implies it's done. |
| `status_for` search | Searching Marktplaats for "{query}"… | **Keep** | Shows the exact query the agent understood. |
| `status_for` propose_watch | Setting up a watch for you… | Drafting a watch for you to check… | Same reason as above; keep the two lines identical. |
| `status_for` propose_watch_change | Preparing the change… | Drafting the change for you to check… | Same pattern. |
| `status_for` fallback | Working… | **Keep** | |
| Button under search results | Watch this search | **Keep** | Verb + object. |
| Proposal (create) | Watch **{search}**, checked **{schedule}**, and e-mail you {notify}. [Save watch] [Adjust] | **Keep** | Signature sentence + two clear actions. |
| Proposal (update) | For **{label}**: {changes}. [Save change] [Dismiss] | **Keep** | |
| Proposal saved | Watch saved. / Change saved. | **Keep** | |

### 2.6 Watch page, watch list, schedule editor — `WatchView.jsx`, `WatchesView.jsx`, `WatchSentence.jsx`, `WatchSheet.jsx`, `ScheduleEditor.jsx`

| Location | Current | Recommended | Why |
|---|---|---|---|
| `WatchSentence` active | Checking Marktplaats for {label} {schedule}, e-mailing you {notify}. | **Keep** | The product's signature line. |
| `WatchSentence` paused | Paused. Resume to keep checking for {label}. | **Keep** | |
| Status, not seeded | Taking a first look at what's listed now… | **Keep** | |
| Status, scheduled | Next check {today at 14:00} · last checked {…} | **Keep** | Concrete times, no promises. |
| Actions | Edit / Pause / Resume / Check now / Delete → "Delete for good?" | Edit / Pause / Resume / Check now / Delete → "Delete this watch?" | Confirm label restates the object (microcopy rule 9). "For good" is fine but less clear on what goes. |
| Section title | Matches | **Keep** | "Match" = a new listing over your bar (glossary, §4). |
| Empty, seeded | No new matches yet. You'll get an e-mail as soon as a good one appears. | No new matches yet. When a check finds a good one, we'll e-mail you. | "As soon as" is a speed promise the product can't keep (15-minute floor; brand-voice "Never: urgent"; brief: never promise instant). |
| Empty, first check | The first check is running. It only notes what's listed now, so you only hear about new ones. | **Keep** | |
| Not found | Watch not found / It may have been deleted. | **Keep** | |
| `WatchesView` empty | Nothing watched yet. Ask the chat to keep an eye on something, or tap New. | **Keep** | Two ways forward, one line. |
| Sidebar empty watches | None yet | **Keep** | Space-limited. |
| `WatchSheet` titles | New watch / Edit watch | **Keep** | |
| `WatchSheet` fields | Item / Title includes / Max price / Near postcode / Within | **Keep** | Short labels; placeholders give examples. |
| `WatchSheet` hint | The first check only notes what's listed now, so you only hear about new ones. | **Keep** | |
| `WatchSheet` submit | Save watch / Save changes / Saving… | **Keep** | |
| `ScheduleEditor` notify options | great matches only / good matches / every new listing | **Keep** labels, add one hint line under the select: "Great is 8 or more out of 10. Good is 6 or more." | Users can't know what "good" means (avatar objection 4: "will it hide a good one?"). Numbers beat adjectives (brand-voice). Keep `NOTIFY_LABEL` unchanged so sentences still read naturally. |
| `ScheduleEditor` summary | Checked {schedule}, Amsterdam time. You hear about {notify}. | **Keep** | |
| `describe()` 12h | twice a day (every 12 hours) | **Keep** | |

### 2.7 Empty states (other surfaces)

| Location | Current | Recommended | Why |
|---|---|---|---|
| `AlertsView` intro | Every listing we e-mailed you, newest first, with its score and the reason for it. | **Keep** | Defines "alert" plainly. |
| `AlertsView` empty | No alerts yet. When a watch finds a good new listing, it shows up here and in your inbox. | **Keep** | |
| History sheet empty (`App.jsx`) | Your chats will show up here. | Your chats show up here. They're deleted after 30 days without use. | Retention said where it applies (microcopy rule 6). |
| `ListingCard` no photo | No photo | **Keep** | |
| `ListingCard` no price | Price on request | No price listed | Marktplaats listings without a price are often "Bieden" or "Zie omschrijving"; "on request" asserts something we don't know. |
| Loading | Loading… | **Keep** | |

### 2.8 Error messages

Pattern (microcopy rule 5): what happened, what happens next, what you can do. No "Error:" prefix, no exception
names, no API jargon.

| Location | Current | Recommended | Why |
|---|---|---|---|
| AI offline, `main.py friendly_error` (503) | The AI model is offline right now (its API key or model is unavailable). Your watches keep running; please try the chat again later. | The chat can't reach its AI right now. Try again in a few minutes. | **Accuracy fix.** When the model is unavailable, scheduled checks also fail at scoring (`check_query`: "Never e-mail unscored listings", retried later), so "your watches keep running" overstates it. "API key or model" is jargon (brand-voice "Jargon: avoided for end users"). |
| Generic failure, `friendly_error` (500) | Error: something went wrong, please try again. | Something went wrong on our side. Try again. | Drop the robotic "Error:" prefix; say whose fault it is. |
| Off-topic refusal | I can only help with Marktplaats searches and watches. | **Keep** | |
| Rate limit, `/api/chat*` (429) | Too many questions in a minute. Please wait a moment. | That's a lot of messages in one minute. Wait a moment, then try again. | Says what to do next. |
| Hourly search cap (tool text, relayed by the chat) | Search limit reached for this hour. Please try again later. | Search limit reached for this hour. Try again after {HH:00}. | Concrete time beats "later" (brand-voice "Concrete"). Needs the reset time in the string. `[DARYL: only if the cap resets on the hour; if it's a rolling window, keep the current line.]` |
| Marktplaats down (watch `lastError`, `agent.py check_query`) | Marktplaats unavailable: {ExceptionName} | Marktplaats didn't answer at the last check. We'll try again at the next one. | Exception class names ("ConnectError") shown to users; replace with plain cause + next step. |
| Search service down (`checker.ts`) | Search service unavailable, will retry. | Our search service didn't answer. We'll try again at the next check. | Same pattern, full sentence. |
| Scoring down (`agent.py`) | Scoring is unavailable right now; will retry. | The AI that scores listings didn't answer. We'll try again soon, and nothing is sent unscored. | Reassures on the real risk (unscored junk) and keeps the promise honest. |
| Check failed fallback (`checker.ts`) | Check failed. | The last check didn't work. We'll try again at the next one. | |
| Unknown postcode (watch `lastError`) | Unknown postcode {pc} | We couldn't find postcode {pc}, so this watch can't run. Delete it and set it up again with another postcode. | Edit mode can't change the postcode (`WatchSheet` edit fields: schedule, notify, max price), so the only real fix is delete + recreate. `[DARYL: or add postcode to edit mode later; not in scope here.]` |
| Invalid postcode on save (`watches.ts`) | A Dutch postcode looks like 1012AB. | **Keep** | Shows the format instead of scolding. |
| Watch limit (`watches.ts`) | You can have up to 5 watches. Delete one first. | You can have up to 5 watches. Delete one to add another. | Says what the delete achieves. |
| Duplicate watch (`watches.ts`) | You already watch "{label}". Edit that one to change its schedule. | **Keep** | Clear cause and fix. |
| Check-now cooldown | Checked a moment ago. Try again in a minute. | **Keep** | |
| Item length | Describe the item in 2 to 80 characters. | **Keep** | |
| Price invalid | The maximum price must be a positive number of euros. | Enter a max price in whole euros, like 500. | Positive instruction with an example; "must" is off-voice (pack SKILL.md: use "want", not "must"). |
| Distance invalid | The distance must be between 1 and 300 km. | Pick a distance from 1 to 300 km. | Same. |
| Schedule errors (`schedule.ts`) | Pick one of: every 15 or 30 minutes, every 1, 3, 6 or 12 hours. / Pick 1 to 4 times a day. / Times look like 08:00. / Pick at least one day. | **Keep** | Already the house style. |
| Session expired (`main.py`) | Your session expired. Please sign in again. | **Keep** | |
| Not signed in | Please sign in first. | **Keep** | |
| No e-mail on account (`users.ts`) | Your account has no e-mail address, so we can't send alerts. | Your account has no e-mail address, so we can't send alerts. Add one under your account (top right). | Adds the fix. `[DARYL: confirm the Clerk UserButton lets users add an e-mail.]` |
| Account load (`App.jsx`) | We couldn't load your account. Refresh to try again. | **Keep** | |
| Save failed (`WatchSheet`) | Saving didn't work. Check your connection and try again. | **Keep** | |
| Save failed (`Proposal`, `Onboarding`, `WatchView`) | Saving didn't work. Try again. / That didn't work. Try again. | **Keep** | |
| Network (`stream.js`) | Can't reach the server. Check your connection and try again. | **Keep** | |
| Stream cut (`ChatView`) | The answer was cut off. Please try again. | **Keep** | |
| Chat save (`ChatView`) | Couldn't save this chat. Try again. | **Keep** | |
| No answer (`agent.py`) | Sorry, I couldn't get an answer. | Sorry, I couldn't get an answer. Try asking it another way. | Adds a next step. |
| Chat not found / Message not found / Unknown proposal / Too many proposals | (as is) | **Keep** | Rare, internal-ish; honest enough. |

### 2.9 Alert e-mail — `frontend/convex/checker.ts renderEmail`

Deliberate deviation: `05-copywriter SKILL.md` §1 asks for "unexpected, playful" subject lines. That rule is for
broadcast e-mails that must earn the open. An alert is transactional: the user asked for it, so clarity and scan-speed
win. The pack's other e-mail rules still apply (short paragraphs, no emojis, no greeting, direct "you").

| Location | Current | Recommended | Why |
|---|---|---|---|
| Subject | {n} new match(es) for {label} (best: {score}/10, €{price}) → e.g. "2 new matches for mac mini (best: 9/10, €230)" | {label}: {n} new match(es), best {score}/10 at €{price} → e.g. "mac mini: 2 new matches, best 9/10 at €230" | Mobile inboxes show ~35 to 40 chars; with several watches, the item name is what the eye looks for first. Keeps count, score and price (brand-voice alert-e-mail row). `[DARYL: capitalise the label's first letter in e-mail? Labels are stored lower-case.]` |
| Preheader (new, hidden) | (none: inbox preview repeats the subject via the `<h2>`) | Best: {best.title}. {best.reason} | The preview line is the second headline (`leads.md`: headline + lead do 80% of the work; writing-rules.md 150-char rule). The reason is the differentiator, so put it in the preview. Needs a hidden `<div>` at the top of the HTML. |
| `<h2>` in body | {subject} | New on Marktplaats for "{label}" | Avoids repeating the subject word for word. |
| Card facts line | €{price}, {city}, scored {score}/10 | Scored {score}/10 · €{price} · {city} | Score first: it's why the e-mail exists. |
| Card reason | {reason} | **Keep** | The product's core value, verbatim from the scorer. |
| Card link | Open on Marktplaats | **Keep** | |
| Overflow | …and {more} more in the app. | …and {more} more in the app, under Alerts. | Says where. |
| Footer | You get this because you watch "{label}", checked {summary}, and asked for {notify}. Marktplaats Watcher is a portfolio project, not affiliated with Marktplaats. | **Keep**, and add: "Replies to this address aren't read." | Current footer is excellent (brand-voice "footer explains why you got it"). The reply line sets expectations for an AgentMail inbox. `[DARYL: is the agentmail inbox read? If yes, drop the line or say "Reply if something looks wrong."]` |
| Footer link | Manage or pause this watch → {APP_URL} | **Keep** text | Link goes to the app root, not the watch. `[DARYL: link to /w/{id} later; code change, out of scope.]` |

### 2.10 Privacy sheet — `frontend/src/views/PrivacySheet.jsx`

| Location | Current | Recommended | Why |
|---|---|---|---|
| Title | Privacy and your data | **Keep** | |
| ¶1 | Alerts go to **{email}**. | Alerts go to **{email}**, from marktplaats-watcher@agentmail.to. | Same sender clarity as onboarding. |
| ¶2 | We keep your e-mail address, your watches, the listings already shown to you and your chats. Anything untouched for 30 days is deleted automatically. Searches and listing titles are sent to OpenAI to score them. Nothing is sold or shared. | We keep your e-mail address and your watches until you delete them. Your chats and the listings we've checked are deleted after 30 days. Your messages, searches and listing details are sent to OpenAI to answer and score them. Nothing is sold or shared. | **Accuracy fix**, same as the landing fine print: watches and the account are not purged at 30 days (`purgeOld`), and chat messages go to OpenAI too. Landing and sheet must say the same thing. |
| ¶3 | A portfolio project, not affiliated with Marktplaats. | **Keep** (add "by Daryl Nunes" only if the landing does) | |
| Delete button | Delete my data → "Delete everything? This can't be undone." | **Keep** | Clear, restates scope and consequence. |

### 2.11 Navigation labels — `Sidebar.jsx`, `TabBar.jsx`, `App.jsx`

| Location | Current | Recommended | Why |
|---|---|---|---|
| Brand | Marktplaats Watcher | **Keep** | |
| Sidebar | New chat / Alerts / Watches (+ "New watch") / Chats | **Keep** | Matches ChatGPT-style mental model. |
| Tab bar | Chat / Watches / Alerts | **Keep** | One word each, same nouns as the glossary. |
| Phone top bar aria | Chats / Back to watches / Privacy and your data / New chat | **Keep** | |
| Watch subtitle when paused | Paused | **Keep** | |
| Watches list score pill | {score}/10 | **Keep** | |

---

## 3. Frameworks applied (from `05-copywriter`, plus supporting pack files)

Pack root: `/Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/`

| Framework | File | How it was applied |
|---|---|---|
| **Five Stages of Awareness + Matching Leads to Awareness** | `05-copywriter/references/long-form-frameworks/leads.md` | Classified LinkedIn visitors as problem-aware (story → problem-solution) and Google visitors as solution-aware (promise + mechanism). Hero serves the Google visitor; the sample block continues the LinkedIn story. |
| **The Four U's** | `05-copywriter/references/long-form-frameworks/leads.md` | Scored the H1. It was strong on Useful and Ultra-specific, weak on Unique; "with the reason" fixes Unique. Urgent is left low on purpose (brand-voice bans urgency). |
| **Market Sophistication + Unique Mechanism (Unspoken Mechanism)** | `05-copywriter/references/long-form-frameworks/frameworks.md` | Market at level 3 to 4 (research.md): a bigger claim won't work, a visible mechanism will. MPAlerts also "reads every listing" but doesn't show why; showing the reason is the Claude Hopkins "unspoken mechanism": say it first and it reads as unique. Hence "we read every new listing, score it 0 to 10 and say why" in lede, H1, steps, preheader. |
| **Bencivenga's Eleven Proof Elements** (Demonstration, Specifics, Reason Why, Candor) and the "never make your claim bigger than your proof" rule | `05-copywriter/references/long-form-frameworks/proof.md` | The real Mac mini check is the demonstration; limits sit next to claims; two claims were cut back because the code doesn't back them (30-day retention scope, "your watches keep running"), and one speed hint was removed ("as soon as"). |
| **Five Universal Objections + Preemptive Objection Handling** | `05-copywriter/references/long-form-frameworks/proof.md` | Mapped the avatar's five objections to No need / No trust, wrote one answering line each, and placed the two trust answers under the CTA. |
| **Salespage §11 CTA patterns, §12 FAQ/Objections, Avatar-First** | `05-copywriter/knowledge-base/salespage-systeem.md` | CTA rewritten as an action with the gain ("Set up a free watch"); objections as plain question → honest answer; every line checked against Joris (buyer-avatar.md). The full 15-section salespage is deliberately *not* used: the product is free and the page is a one-screen landing. |
| **AIDA (single CTA per context)** | `05-copywriter/references/long-form-frameworks/frameworks.md` | One primary CTA on the landing; "Sign in" stays as a secondary header link for returning users. |
| **E-mail writing rules** (short paragraphs, no greeting, no emojis, "want" not "must") | `05-copywriter/SKILL.md` §1 | Applied to the alert e-mail and to validation errors ("must be" → instruction). The playful-subject rule is consciously overridden for a transactional alert. |
| Supporting: message hierarchy, objections, traffic temperature | `03-strategist/.claude/commands/avatar.md`, `funnel.md` | Primary promise, proof order, objections from avatar §12D; LinkedIn = warm-ish story traffic, Google = cold solution-aware traffic. |
| Supporting: plain-language rules | `06-content-creator/knowledge-base/linkedin/writing-rules.md` | No em dashes, one sentence = one job, no filler, 150-char rule for meta description and preheader, "Alleen Jij" specifics. |
| Supporting: differentiation axes | `10-product-builder/knowledge-base/product-validatie.md` | "Different method" (the reason) and "different price" (free) are the only provable axes; copy leans on those and not on speed or coverage. |
| Supporting: title/meta/H1 | `09-seo-specialist/SKILL.md`, `knowledge-base/technische-seo.md` | Title ≤60 with keyword first, meta ≤155 with the offer, one H1 containing "Marktplaats". |

---

## 4. Microcopy rules for this app

1. **Three voices, never mixed.** The chat is "I". The product (pages, errors, e-mails, privacy) is "we". The user's
   own fill-in sentences use "me" ("…and e-mail me good matches").
2. **One glossary.** *Watch* = a saved thing we check. *Check* = one look at Marktplaats. *Match* = a new listing over
   your bar. *Alert* = a match we e-mailed you. *Score* = "9/10". *Reason* = the one line that says why. Don't swap
   them for synonyms (search, notification, rating).
3. **Numbers over adjectives.** €230 (no decimals, no space), 9/10, 08:00 (24-hour, Amsterdam time), "every 15
   minutes", "10 km", "5 watches", "30 days".
4. **No speed promises.** Never "instant", "as soon as", "real-time", "never miss", "be the first", "AI-powered".
   Say "at the next check" or name the schedule.
5. **Errors say three things:** what happened, what happens next, what you can do. No "Error:" prefix, no exception
   names, no "API key", no stacked "please".
6. **Say the catch where it bites.** First check is silent, the chat shows one page, 5 watches max, 30-day retention, not
   affiliated: put each one next to the action it affects, not only in fine print.
7. **Nothing is "saved" until the user presses Save.** Status and chat lines draft, propose or prepare; only the
   button result says "saved".
8. **Style.** Sentence case, contractions, no exclamation marks, no emojis, no em dashes, "…" only for work in
   progress. Validation messages instruct ("Pick…", "Enter…"), they don't say "must".
9. **Buttons are verb + object, three words max** (Save watch, Check now, Watch this search). A destructive confirm
   restates what goes ("Delete this watch?").
10. **English UI; the chat mirrors the user.** Dutch in, Dutch out (SYSTEM_PROMPT). Any Dutch UI copy needs a native
    check before it ships, and uses "je", never "u".

---

## 5. Open decisions for Daryl

- `[DARYL: OK to put your name on the landing page and privacy sheet ("A free portfolio project by Daryl Nunes")?]`
- `[DARYL: confirm the SSDs, tracker and Cisco switch came from the same check as the €230 Mac mini; else retitle the sample block.]`
- `[DARYL: confirm Clerk sign-in methods (e-mail only, or Google too) for the line under the CTA.]`
- `[DARYL: confirm listing descriptions are not sent to OpenAI (privacy copy says "listing details").]`
- `[DARYL: do you want end-user search traffic at all, given ToS art. 7.3? Decides how much SEO copy matters.]`
- `[DARYL: test Marktplaats' native saved search before any copy compares frequency.]`
- `[DARYL: is the agentmail inbox read? Decides the "Replies aren't read" footer line.]`
- `[DARYL: capitalise watch labels in e-mail subjects?]`
- `[DARYL: does the hourly search cap reset on the hour? Decides the "Try again after {HH:00}" line.]`
- `[DARYL: customise the Clerk modal copy (optional)?]`
- `[DARYL: Dutch landing hero now, later, or never? (Needs native check either way.)]`
- `[DARYL: later (out of scope): postcode in edit mode; e-mail "Manage" link straight to /w/{id}.]`

## Metadata
- **Created:** 2026-09-27
- **Method:** 05-copywriter (translated), 03-strategist, 02-onboarding brand voice, 06 writing rules, 10 validation, 09 SEO
- **Inputs:** references/brand-voice.md, research.md; generated/buyer-avatar.md, validation.md; competitors/*; app source strings
- **Status:** Draft; no string in the app has been changed
