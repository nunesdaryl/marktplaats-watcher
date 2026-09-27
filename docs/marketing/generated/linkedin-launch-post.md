# LinkedIn Launch Post: Marktplaats Watcher

> Built with `06-content-creator` `/social-post linkedin` (quick mode): `writing-rules.md`, `templates.md`,
> `hooks-library.md`, `platform-guides/linkedin.md`, plus this vault's `references/brand-voice.md` (LinkedIn Voice
> Profile), `generated/linkedin-audience.md`, `generated/validation.md` and `references/research.md`.
> The pack is Dutch; the post is English. Every fact comes from the verified end-to-end run of 2026-09-27.
> Nothing about Daryl's personal story is invented: the one personal line is a `[DARYL: ...]` slot.

## Intake

| Question | Answer |
|---|---|
| Topic | Launch of Marktplaats Watcher, told through one moment: the Cisco switch that became the reason for AI scoring |
| Goal (pack) | **Positioneren** (authority) with a light **Converteren** (click the link in the first comment) |
| Audience | Hiring managers, potential clients, fellow FDE/AI engineers (`linkedin-audience.md`) |
| "Only you" material | Mac mini query, Cisco switch e-mailed as a match, 10 live listings (3 scored 7 to 9, 7 scored 0), €230 match at 9/10 with a quoted reason, Gmail inbox not spam, competitors show no reason |

## Template and hook choice

Three candidates (pack step 3):

| Template | Why it fits | Why not chosen |
|---|---|---|
| **#6 Case Study (narrative)** | Hook with the result, starting point, what broke, turning point, result with numbers, lesson. The Cisco switch is a real turning point and the 3-vs-7 test is a real result. | **Chosen** |
| #24 Laat Je Werk Zien | Good for a launch, shows effort | Its milestone-and-features list turns one idea into a feature tour |
| #5 Tool Showcase | A "wow moment" demo | Reads like an ad; weaker for hiring managers than a decision with evidence |

**Hook category: #4 Story Tease** ("I thought X. Then Y."), with the dry humour the brand voice allows
("I searched for a Mac mini. It found me a Cisco switch."). The first line does not open with "I". The hook is
89 characters, well inside the ~150 visible before "...see more" (mobile cuts at ~140).

## The post (ready to paste)

Length: **1,100 characters** including the placeholder line, **1,019** without it. Keep Daryl's line under ~90
characters so the post stays under 1,200.

```
My Marktplaats watcher was looking for a Mac mini.
It e-mailed me a Cisco network switch.

The search results for "mac mini" included it. My watcher passed it straight on.

So now nothing gets sent until the AI has read the listing, scored it 0 to 10, and written one line on why.

On 27 September I tested it on 10 live listings for "mac mini".
3 real Mac minis scored 7 to 9.
7 others scored 0: docking stations, SSD enclosures, a Bluetooth tracker, and a Cisco switch.

The real match from my test run: Mac mini i5, 16GB, €230. Scored 9/10, "only the missing location/distance keeps it from a perfect score." It landed in my inbox, not spam.

On the alert sites I reviewed, I didn't find a per-listing reason.

[DARYL: one personal line, in your own words, on why the reason matters to you]

It's live: say what you want in plain words, pick when to check, and only listings that meet your chosen score reach your inbox. A portfolio project from my Forward Deployed Engineer course, not affiliated with Marktplaats. Link in the first comment.

If you build agents: what should an alert explain before you'd trust it?
```

If Daryl has no personal line, delete the slot entirely; the post still stands (1,019 characters).

### First comment (post it yourself within a minute of publishing)

```
Try it: https://marktplaats-watcher.vercel.app
Built with Next.js, FastAPI with a LangChain tool-calling agent, Convex, Clerk, AgentMail and Vercel.
```

## 3 alternative hooks

| # | Hook category | Hook (characters) |
|---|---|---|
| A | #2 Resultaten / Bewijs | `10 live Marktplaats listings for "mac mini". Only 3 were Mac minis. So my agent now scores every one, and says why.` (115) |
| B | #4 Story Tease | `I searched Marktplaats for a Mac mini. It gave me docking stations, SSD enclosures, a Bluetooth tracker and a Cisco switch.` (123) |
| C | #1 Contrarian | `On the Marktplaats alert sites I reviewed, I didn't find a reason next to a listing. So mine gives one.` (103) |

Hook B is the strongest swap if the Cisco line feels overused after the brand-voice samples. Hook C suits a
client-facing audience but leans on competitors in the first line; keep it for the research post in the series.

## Recommended image

1. **Primary: `frontend/public/og-image.png`.** It is the one idea of the post in a single picture: "Mac mini i5,
   16 GB, €230, 9/10, E-mailed" next to "Mac Mini M4 Docking Station, 0/10, Not a Mac mini. Skipped." It works on
   its own in the feed (pack rule: the visual must stand alone), contains no personal data, and matches the
   template's visual (#6: before/after metrics).
2. **Alternative (more "proof", less "design"): a crop of the right-hand "Your watches" panel of
   `docs/img/mvp/scored-alert-and-refusal.jpg`**, showing the €230 Mac mini, 9/10 and the reason text quoted in the
   post. Crop out the chat (the refusal is a separate post) and **crop out "Alerts go to darylnunes@gmail.com"**
   at the bottom.
3. Not for this post: `chat-proposal.jpg` and `schedule-picker.jpg` belong to the "propose, don't act" and
   "plain-English schedules" posts. Both also show the e-mail address; crop it before using them.

`[DARYL: optional, strongest proof of all: a screenshot of the real alert e-mail in Gmail with the address and
unrelated inbox rows blurred. Not in the verified image list, so only use it if you take it yourself.]`

## Where the link goes

In the **first comment**, not the post. `platform-guides/linkedin.md` ("Veelgemaakte Fouten #1"): external links in
the post "verlagen je bereik dramatisch" and are penalised in the first quality filter; the brand voice's CTA style
says the same. The post says "Link in the first comment" so readers know where to look. The comment's link preview
will show `og-image.png`, which is why the post image can be the same picture or the cropped screenshot.

**Do not publish before the Vercel deploy is confirmed live**: open the URL in a private window and sign in once.

## When to post

Tuesday 29 September 2026, 07:30 to 08:30 (pack: best slot Tue/Wed/Thu 07:30 to 08:30; avoid weekends). That is
four days before demo day (Saturday 3 October), so the post can be referenced at the demo. Reply to every comment
in the first hour (pack: engagement velocity).

## Quality gate

| Check (pack) | Result |
|---|---|
| No hashtags | Pass |
| No em dashes (also no en dashes) | Pass (checked by script) |
| Hook works in 150 characters | Pass: lines 1 and 2 are 89 characters and tell the whole twist |
| Length 500 to 1,200 | Pass: 1,019 to ~1,190 depending on Daryl's line |
| One post = one idea | Pass: "an alert should say why". The guardrail, schedules, silent first check and stack are left for the series |
| Every sentence has one job | Pass: hook / context / turning point / evidence / proof / gap / CTA |
| No filler, no hype words | Pass: no "never miss", "AI-powered", "revolutionary", no exclamation marks |
| Emojis | None |

### "Alleen Jij" filter

Could anyone else have written this post? **No.**

| Element (pack) | In the post |
|---|---|
| Number | 10 listings, 3 scored 7 to 9, 7 scored 0, €230, 9/10 |
| Example | A Cisco network switch sent as a Mac mini "match"; docking stations, SSD enclosures, a Bluetooth tracker |
| Specific moment | The switch being e-mailed as a match, which is why scoring exists |
| Time frame | Weak: not included. The honest one ("during my FDE course") is in the post; do not add dates you can't back |

Remaining gap: the personal "why". Only Daryl can fill `[DARYL: ...]`; the filter passes without it, but the
**"reveals something personal"** box below only fully passes with it.

### Anti-boring checklist (minimum 3 of 5)

| Question | Answer |
|---|---|
| Specific story or example? | **Yes**: the Cisco switch and the 10-listing test |
| Does it challenge something? | **Yes**: "search results are matches" and "alert apps compete on speed" |
| Personal / behind-the-scenes? | **Partly**: a real test run and a real inbox; fully yes once Daryl's line is in |
| Would I stop scrolling for the hook? | **Yes**: a Mac mini search that returns a network switch is absurd and visual |
| Passes "Alleen Jij"? | **Yes** |

**Score: 4 of 5 (5 of 5 with Daryl's line). Pass.**

## Iterate options (pack step 7)

Shorter (drop the competitor paragraph, ~900 characters) / more story (open with what Daryl was hunting for, needs
his input) / punchier / softer close ("Curious what others make their agents explain.").

## Repurpose

- X thread: `generated/x-repurpose.md`.
- LinkedIn follow-ups: `generated/linkedin-series.md` (8-post, 2-week calendar).

## Metadata
- **Created:** 2026-09-27
- **Status:** Draft, ready after Daryl fills `[DARYL: ...]` and confirms the live URL
