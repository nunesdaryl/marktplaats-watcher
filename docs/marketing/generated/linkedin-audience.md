# LinkedIn Audience Avatar — portfolio posts about how Marktplaats Watcher was built

> Short avatar for audience (b): hiring managers, potential clients and fellow FDE/AI engineers. Uses
> `06-content-creator/knowledge-base/linkedin/` (writing-rules.md, templates.md, hooks-library.md) and
> `platform-guides/linkedin.md`. What these readers "look for" is inference from the FDE role and the pack's
> LinkedIn guidance, not interviews. `[NEEDS REVIEW: validate with 2–3 hiring managers or course instructors]`

## Three readers, one post

| Reader | What they're really asking | What convinces them | What loses them |
|---|---|---|---|
| **Hiring manager / tech lead** (AI startups, consultancies hiring FDEs) | "Can this person take a messy real problem to a working, safe product without hand-holding?" | A live URL; scoping decisions with reasons; auth, secrets, tests, CI; a named limit they chose to accept; how they'd measure quality | Buzzwords, "I built an AI app" with no specifics, tutorial clones, overclaiming |
| **Potential client** (SME with an ops problem) | "Could he build something like this for *my* process?" | The pattern, not the Marktplaats detail: watch a source → filter with AI → notify a human who decides. Plain language, cost awareness, privacy | Deep jargon, no business outcome |
| **Fellow FDE / AI engineer** | "What did you learn that I can use?" | Concrete technique: propose-don't-act tools, structured-output scoring, prompt-injection guard ("data, not instructions"), silent first check, shared-request dedupe | Vague lessons, no code or numbers |

## What the portfolio audience looks for in an FDE project (checklist)

1. **A real user and a real problem**, stated in one line.
2. **Scoping judgement:** what you left out and why (e-mail only, first page only, 15-minute floor, 5 watches).
3. **Agent design that keeps a human in control:** chat proposes, user clicks Save.
4. **Production hygiene:** Clerk token on every call, cron secret, no secrets in the image, retention + delete,
   escaped e-mails, tests + CI.
5. **Honesty about risk:** Marktplaats ToS art. 7.3, accepted knowingly; not affiliated.
6. **Evidence of quality:** the gap today. There is no measured scoring accuracy. A 50-listing hand-labelled eval
   ("does the score match my judgement?") would be the single strongest portfolio upgrade.
   `[NEEDS REVIEW: decide whether to run it before posting]`
7. **Communication:** can explain it to a non-engineer in two sentences.

## Their language

"shipped", "end to end", "in production", "trade-off", "scope", "guardrails", "evals", "human in the loop",
"tool calling", "cost per check", "what would you do differently".

## Content angles (mapped to pack templates and hooks)

| Angle | Template (templates.md) | Hook type (hooks-library.md) | One-line seed |
|---|---|---|---|
| The Cisco switch | #12 Fout Corrigeren / #4 Kwetsbaar Verhaal | Story Tease | "I asked my agent for a Mac mini. It found me a Cisco switch." |
| Propose, don't act | #1 Contrarian Take | Contrarian | "My AI agent is not allowed to save anything. On purpose." |
| How it works | #2 Proces Uitleg / #7 Tech Stack | Proces Onthullen | "From one sentence to a scheduled, scored e-mail: the 6 parts." |
| What I left out | #21 Radicale Transparantie | Herkenbaarheid | "5 things my Marktplaats watcher deliberately doesn't do." |
| The ToS decision | #16 Harde Waarheid | Fout Waarschuwing | "Marktplaats' terms forbid what my app does. Here's how I decided." `[NEEDS REVIEW: legal/visibility risk of this post]` |
| Pattern for businesses | #28 Voordeel van het Voordeel | Directe Waarde | "Swap 'Marktplaats' for 'tenders' or 'supplier prices' and it's the same system." |

## Rules to apply (from writing-rules.md)

No hashtags. No em dashes. Hook works in the first ~150 characters. One post = one idea. 500–1200 characters.
"Only you" filter: every post needs a specific number, item or moment from this build. Link to the app or repo in
the first comment, not the post (links reduce reach, per platform-guides/linkedin.md).

## Metadata

- **Created:** 2026-09-27
- **Status:** Draft (inferred audience needs)
