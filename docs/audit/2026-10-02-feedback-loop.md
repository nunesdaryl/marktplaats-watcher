# Feedback loop audit: Marktplaats Watcher

**Date:** 2 October 2026 · **State audited:** `main` at `c668b83` (MW-52 spec addendum).
**Question:** how does a user's observation become a checked release and a reply?
**Scope:** a written audit of the paths and factory run described in the MW-52 problem statement
(2 October), checked against the cited repo files. It does not implement the planned loop.

## 1. Summary

**Verdict.** The app listens, but the route from listening to a release is manual and
incomplete. In-app feedback reaches an owner e-mail and `/admin`; ratings reach `/admin`, but
need a manual export even to appear in the eval report. Neither input is a source for factory
draft specs. The current feedback record can only be marked handled, with no issue, release or
reply attached. Sources: `frontend/convex/feedback.ts:40-84,87-109`;
`frontend/convex/admin.ts:167-200,744-750`; `frontend/convex/ratings.ts:123-129`;
`evals/pull_ratings.py:12-17`; MW-52 problem statement, factory survey (2 October).

**The intended loop, in one line:** listen → check the evidence → write and approve a small spec
→ build → run the machine gate and human review → merge → verify production → publish the result
→ record and reply → listen again. Sources: Day 3, *Second brain and software factory*, p20;
`3 Skills/fde-skill/SKILL.md:112-125`; Day 1 deck, slide 26.6.

This audit is a dated snapshot. The six follow-up issues in §7 describe planned work; they are
not evidence that the target loop already runs. Source: Linear MW-47–MW-51 and MW-53, issue
descriptions read 2 October.

## 2. The loop today

| Channel | Where it lands | Who reads it | What happens next, and the gap |
|---|---|---|---|
| In-app feedback | The signed-in beta strip opens the sheet. It asks for a message and optional would-pay answer; a screenshot can be removed. `feedback` stores context, screenshot id and a handled timestamp. Sources: `frontend/src/components/BetaBanner.jsx:5-12`; `frontend/src/App.jsx:136-143`; `frontend/src/views/FeedbackSheet.jsx:40-50,66-80`; `frontend/convex/schema.ts:73-83`. | The owner gets one e-mail per item and can inspect it with the preceding ten events on `/admin`. Sources: `frontend/convex/feedback.ts:87-109`; `frontend/convex/admin.ts:167-198`; `frontend/src/views/admin/Overview.jsx:120-157`. | Submit is limited to ten per day, 2,000 characters and a 1.5 MB image. The owner can mark an item handled or reopen it. There is no status trail, linked issue, release or reply in this record. Sources: `frontend/convex/feedback.ts:17-19,40-84`; `frontend/convex/admin.ts:744-750`; `frontend/src/views/admin/Views.jsx:129-143`. |
| Alert ratings | Alerts and e-mail links collect Yes / Not right, with reasons and a note. Ratings are stored by alert and exposed to an owner-only export. Sources: `frontend/src/components/RateAlert.jsx:11-58`; `frontend/src/views/RateView.jsx:11-48`; `frontend/convex/ratings.ts:34-58,123-129`. | The owner sees counts, score bands and reasons on `/admin`. Sources: `frontend/convex/admin.ts:570-595`; `frontend/src/views/admin/Overview.jsx:201-240`. | `evals.pull_ratings` must be run by hand. Its JSON output is read by `report.py`, not by the scorer or gate; the checked-in report still says there are no ratings. Sources: `evals/pull_ratings.py:12-17`; `evals/report.py:62-93,156`; `evals/report.md:56-58`; `evals/gate.py:20-29`. |
| Usage and funnel | `track` records named events; the funnel counts setup, chat, saved watches and alerts. Vercel Analytics supplies visitor figures. Sources: `frontend/src/lib/track.js:14`; `frontend/convex/events.ts:14-19,29-46`; `frontend/convex/admin.ts:102-112`; `README.md:89-99`. | The owner sees the dashboard. Source: `README.md:89-99`. | Events are purged after 90 days. The funnel describes movement, but a drop-off does not itself create a factory issue. Sources: `frontend/convex/crons.ts:11`; `frontend/convex/admin.ts:102-112`; MW-52 problem statement, draft-pass survey (2 October). |
| Errors | Chat and check errors are stored with request ids. Source: `frontend/convex/health.ts:21-24`. | The owner sees the error view and the 05:00 health digest when problems are present. Sources: `README.md:89-99`; `frontend/convex/crons.ts:9-10`; `frontend/convex/health.ts:115-135`. | The digest summarises operations, not feedback or ratings. Source: `frontend/convex/health.ts:115-135`. |
| Delivery audit | The audit runs daily at 04:30 UTC and records missed eligible alerts. Source: `frontend/convex/crons.ts:8`; `docs/system-design.html:930-935`. | The owner sees misses in the digest and dashboard. Source: `docs/system-design.html:930-935`. | A miss can prompt investigation; the current draft-pass sources do not include audit misses. Source: MW-52 problem statement, factory draft-pass survey (2 October). |
| E-mail and outside channels | An in-app item sends an owner e-mail; the 1 October WhatsApp observation stayed outside the feedback table. Sources: `frontend/convex/feedback.ts:87-109`; `frontend/convex/schema.ts:73-83`; MW-52 problem statement, WhatsApp observation (1 October 23:49). | Daryl reads the owner mail and the outside message. Sources: `frontend/convex/feedback.ts:87-109`; MW-52 problem statement, WhatsApp observation. | Outside remarks need manual transcription before they can be triaged beside app feedback. The current schema has no source or external-contact field. Source: `frontend/convex/schema.ts:73-83`; Linear MW-48, Problem and Acceptance Criteria. |

### What the signal cannot yet prove

The dashboard's rating agreement is a count of people who rated, not an estimate for all alerts:
its numerator and denominator come from the ratings and sent-alert queries, and the UI calls it
agreement per score band. Source: `frontend/convex/admin.ts:570-595`;
`frontend/src/views/admin/Overview.jsx:213-237`.

The checked-in eval report records 53 listings and no user ratings as of this audit. The current
dataset declaration lists five watches, while the MW-52 survey calls the frozen scorer set three
watches; use the source file and a fresh eval run when making a current coverage claim. Sources:
`evals/report.md:9,56-58`; `evals/common.py:27-34`; MW-52 problem statement, eval survey (2
October).

The Monday 06:00 UTC eval job and its manual trigger exist. The pull-request trigger covers
`agent.py` and `evals/**`; local factory merges without pull requests did not exercise that
trigger in the 36 merges reported by the MW-52 survey. The gate requires at least 19/20 chat
cases and median corrected great-match precision of 0.9. Sources:
`.github/workflows/evals.yml:3-10,34-45`; `evals/gate.py:15-22`; MW-52 problem statement,
factory survey (2 October).

## 3. The factory as run versus as designed

The table compares the 1 October factory run recorded in the MW-52 problem statement with the
course's staged loop. It describes observed exposure, not an unobserved failure. Source: MW-52
problem statement, factory survey (2 October); Day 3, *Second brain and software factory*, p20.

| Stage | As run on 1 October | Intended gate and current risk |
|---|---|---|
| Spec | Draft-pass sources were review follow-ups, architecture gaps, TODOs, memory and operator remarks. No skill read user feedback. Source: MW-52 problem statement, factory survey. | Intake should turn observed need into a bounded spec that a human marks ready. Without a feedback source, a valid customer observation can remain outside the queue. Sources: Day 3, p20; Linear MW-50, Problem and Acceptance Criteria. |
| Build | Helpers and briefs lived in a temporary job directory; `.factory.json` only named team MW and medium Codex effort. Sources: MW-52 problem statement, factory survey; `.factory.json:1-4`. | A repeatable repo-local runner and isolated issue branch are planned in MW-47. Temp-only scripts can disappear with a session. Source: Linear MW-47, Problem and Acceptance Criteria. |
| Machine gate | The merge helper ran local checks. The PR-triggered eval workflow did not run on the reported 36 local merges. Sources: MW-52 problem statement, factory survey; `.github/workflows/evals.yml:3-10`. | Tests, dependency and secret checks, plus relevant evals, must be tied to the reviewed change. A green local check is useful but does not establish that the separate eval workflow ran. Sources: `3 Skills/fde-skill/references/checklists.md:73-80`; `.github/workflows/evals.yml:34-45`. |
| Review | The described helper did not pin the reviewed branch SHA for merge. Source: MW-52 problem statement, factory survey. | Human review must identify the exact artifact. A later tip could otherwise differ from what was reviewed. Sources: Day 3, p20; Linear MW-47, Acceptance Criteria. |
| Merge gate | `merge.sh` used `git merge --no-ff` into `wave1-demo-ready`, then fast-forwarded and pushed main; it had no label re-check or merge log. Source: MW-52 problem statement, factory survey. | MW-47 specifies a reviewed-SHA and `ready-to-merge` check, clean main checkout and recorded merge. Without those checks, the merge decision is not reproducible from the repo. Source: Linear MW-47, Acceptance Criteria. |
| Deploy | The helper deployed Convex if Convex changed, then polled GitHub deployments for Vercel. Source: MW-52 problem statement, factory survey. | The deploy check should identify the production SHA and fail if it differs from the reviewed release. Source: Linear MW-47, Acceptance Criteria. |
| Publish | The helper ran a curl smoke check. Source: MW-52 problem statement, factory survey. | A smoke check and a user-visible release record make the result inspectable. No link from a feedback item to that release exists today. Sources: Linear MW-47 and MW-48, Acceptance Criteria; `frontend/convex/schema.ts:73-83`. |
| Record | The helper posted Linear comments, but only the merged comment had three retries; issue label swap and state were separate calls. `lin.py` used unpaged reads and bare `urlopen`. Source: MW-52 problem statement, factory survey. | A chronological issue and release record should survive partial failures, then a reply should tell the user what happened. Sources: `3 Skills/fde-skill/references/checklists.md:79-80`; Day 1 deck, slide 26.6; Linear MW-48, Acceptance Criteria. |

The current repo has no `scripts/factory-merge.sh`; its `.factory.json` has no feature-branch
push grant or gate setting. These are dated observations, not instructions to bypass the
station's current safeguards. Sources: `.factory.json:1-4`; MW-52 problem statement, factory
survey (2 October).

## 4. What the course and marketing pack prescribe

Status means **met in this feedback-to-release path as of 2 October**, not an overall course
grade. A partly met item has a live component but lacks the full link. Sources for status are in
each row.

| Practice | Source | Status | Gap here |
|---|---|---|---|
| Show the work, hear the next requirement | Day 1 deck, slide 5.1 | 🟡 | Feedback is collected, but not carried into factory intake. Sources: `frontend/convex/feedback.ts:40-84`; MW-52 factory survey. |
| Treat shipping as the middle; make the owner and decision visible | Day 1 deck, slides 16.1–16.4 | 🟡 | The owner has an inbox and dashboard; handled is the only recorded disposition. Sources: `frontend/convex/feedback.ts:87-109`; `frontend/convex/admin.ts:744-750`. |
| Say value, effort and risk; frame a hypothesis and three numbers | Day 1 deck, slide 17.5 | 🟡 | Funnel and alert counts exist, but there is no weekly feedback decision record. Sources: `frontend/convex/admin.ts:102-112`; MW-52 factory survey. |
| Tell users what is happening during incidents | Day 1 deck, slide 23.x | 🟡 | Errors and a health digest exist; the feedback record does not store a sent reply. Sources: `frontend/convex/health.ts:21-24,115-135`; `frontend/convex/schema.ts:73-83`. |
| Use 20–200 real cases, human review and weekly evals | Day 1 deck, slides 24.1, 24.3–24.4; `3 Skills/fde-skill/references/checklists.md:25-33` | 🟡 | The report has 53 listings and a Monday eval schedule; user ratings are not scorer cases. Sources: `evals/report.md:9,56-58`; `.github/workflows/evals.yml:8-10`; `evals/report.py:156`; `evals/gate.py:20-29`. |
| Watch adoption, then feed customer response into the next release | Day 1 deck, slides 26.4 and 26.6; Day 1 cheat sheet, p2 | 🟡 | Dashboard usage exists, but no feedback-to-issue-to-release trail. Sources: `frontend/convex/admin.ts:102-112`; `frontend/convex/schema.ts:73-83`. |
| Reuse a skill after two corrections; run intake, gate, review, ship and record | Day 3, *Second brain and software factory*, pp17, 20; `3 Skills/fde-skill/SKILL.md:112-125`; `references/checklists.md:73-80` | 🟡 | Factory stages ran, but intake and recorded merge evidence need the repo-local work in MW-47 and MW-50. Sources: MW-52 factory survey; Linear MW-47 and MW-50. |
| Draft a customer-service answer for a person to send | `3 Skills/agent-skill-pack/08-customer-service/SKILL.md:1-3` | ❌ | Feedback has an owner notification, not a reply draft or sent record. Sources: `frontend/convex/feedback.ts:87-109`; `frontend/convex/schema.ts:73-83`. |
| Collect real customer language and testimonials | `3 Skills/agent-skill-pack/02-onboarding/SKILL.md:602-637`; `docs/marketing/references/testimonials.md:6-15` | 🟡 | The collection plan exists; the reference still says there are no own reviews. The 1 October outside observation has not been recorded there. Sources: MW-52 WhatsApp observation; `docs/marketing/references/testimonials.md:6-15`. |
| Validate with the smallest real-user test before adding scope | `3 Skills/agent-skill-pack/10-product-builder/knowledge-base/product-validatie.md`, validation ladder; `docs/marketing/generated/validation.md:44-54`; `3 Skills/agent-skill-pack/03-strategist/SKILL.md:114-126` | 🟡 | The local plan calls for 8–10 beta users over 14 days; one positive user report is a signal, not payment or a cohort result. Sources: `docs/marketing/generated/validation.md:44-54`; MW-52 WhatsApp observation. |

## 5. The first real loop: a beta user's feedback

On **1 October 2026 at 23:49**, a beta user in the FDE cohort's WhatsApp group shared the
**08:05** Mac mini watch alert: a Mac mini M4 at **€675**, scored **9/10**. In paraphrase, the
user reported that the service felt smooth and stable, did its one job well, saved time and
effort, and helped them reach Mac mini listings early enough to bid first. They advised
concentrating on that job. This is one person's unprompted account, not a measured delivery-time
guarantee or permission to publish their words. Source: MW-52 problem statement, WhatsApp
observation (1 October 23:49).

The product lesson is **early access to good listings**, with reliability as the condition that
makes it useful. That directs evaluation toward both relevance and whether an eligible alert
actually arrives; it is not a reason to add more features. Sources: MW-52 WhatsApp observation;
`docs/system-design.html:930-935`; Day 1 deck, slide 26.6. The current validation
plan still needs 8–10 beta users and 14 days, and the user-rating path has not produced scorer
cases. Sources: `docs/marketing/generated/validation.md:44-54`; `evals/report.md:56-58`;
`evals/report.py:156`.

The next legitimate steps are to log this outside-channel item with its date and paraphrase, ask
for permission before using a testimonial, and link any resulting change to its issue and
release. Those are the scopes of MW-48 and MW-53. Source: Linear MW-48 and MW-53, Acceptance
Criteria. No product copy or customer quote is approved by this audit.

## 6. The target loop on one page

This is the **proposed Monday routine**, not a command that already exists. Its order follows
Day 3's intake → gate → review → ship and record path and the planned MW-47–MW-51 work. Sources:
Day 3, p20; Linear MW-47–MW-51, Acceptance Criteria.

| When | Owner | Input and decision | Gate or record |
|---|---|---|---|
| Monday, after the 05:00 UTC digest | Daryl | Read health, audit misses, `/admin` feedback and ratings, and outside-channel notes. Sources: `frontend/convex/crons.ts:8-10`; `frontend/convex/admin.ts:167-198,570-595`; Linear MW-48. | Mark each item as a question, defect, praise or support need, with its source and date. Planned tracker: Linear MW-48. |
| Monday intake | Daryl | Review candidate problems and the last week's adoption signal. Planned draft source: Linear MW-50; funnel: `frontend/convex/admin.ts:102-112`. | Prefer evidence-cited, small specs. Daryl alone marks selected drafts agent-ready. Sources: Linear MW-50, Acceptance Criteria; Day 3, p20. |
| Build and review | Factory builder, then independent reviewer | Build one approved issue; run relevant tests and evals; exercise the result against acceptance criteria. Sources: Day 3, p20; `3 Skills/fde-skill/references/checklists.md:73-80`; Linear MW-47. | Review the exact SHA; a failed gate returns to build. Sources: `3 Skills/fde-skill/SKILL.md:123-125`; Linear MW-47, Acceptance Criteria. |
| Merge and verify | Operator and merge gate | Merge only the reviewed revision, deploy needed parts, confirm production SHA and smoke checks. Source: Linear MW-47, Acceptance Criteria. | Record issue, reviewer, merge SHA, deployment and result. Sources: Linear MW-47, Acceptance Criteria; `3 Skills/fde-skill/references/checklists.md:79-80`. |
| Publish and close | Daryl | Mark linked feedback shipped or declined with a reason; review a short drafted reply, then send it personally. Sources: Linear MW-48, Acceptance Criteria; `3 Skills/agent-skill-pack/08-customer-service/SKILL.md:1-3`. | Record what was sent and when; preserve the original observation as a paraphrase until permission exists. Sources: Linear MW-48 and MW-53, Acceptance Criteria. |
| Next Monday | Daryl | Check whether the change helped: started, finished, came back; inspect pending user eval cases. Sources: Linear MW-51, Acceptance Criteria; Day 1 deck, slides 17.5, 24.4, 26.6. | Confirm cases before adding them to the scorer set and repeat the loop. Source: Linear MW-49, Acceptance Criteria. |

For the beta user's 1 October note, a future reply would say what was heard, what changed, and
where to see the change. Daryl would check and send that draft only after a verified release;
this audit does not claim such a release exists. Sources:
`3 Skills/agent-skill-pack/08-customer-service/SKILL.md:1-3`; Linear MW-48, Acceptance Criteria;
MW-52 WhatsApp observation.

### Decision rules for the proposed routine

These are proposed operating rules derived from the cited course and follow-up scopes.
They do not describe controls that exist in the current app. Sources: Day 1 deck,
slides 17.5, 24.3–24.4 and 26.6; Linear MW-47–MW-51, Acceptance Criteria.

1. Preserve the observation before interpreting it. A message, rating or audit miss
   needs a date, source and enough context to reproduce the decision. Feedback already
   captures page, environment and recent errors; ratings keep alert-level reasons.
   Sources: `frontend/convex/schema.ts:20-29,73-83,85-95`;
   `frontend/convex/ratings.ts:34-58`; Linear MW-48, Acceptance Criteria.

2. Separate praise from a product requirement. The 1 October message shows value to
   one beta user; it does not establish an alert-speed distribution, payment intent or
   a stable cohort result. Sources: MW-52 WhatsApp observation;
   `docs/marketing/generated/validation.md:44-54`; Day 1 deck, slide 17.5.

3. If the problem is a wrong score, inspect the underlying listing and watch before
   promoting a user rating to a scorer case. MW-49 explicitly requires an operator
   confirmation step. Sources: Linear MW-49, Acceptance Criteria;
   `frontend/convex/admin.ts:570-595`; Day 1 deck, slide 24.3.

4. If the problem is a missed alert, compare expected and delivered matches before
   writing a feature spec. The delivery audit exists for that difference, while the
   owner's digest reports its misses. Sources: `frontend/convex/crons.ts:8-10`;
   `docs/system-design.html:930-935`; Day 1 deck, slide 26.6.

5. A draft from feedback remains a draft until Daryl chooses the scope and marks it
   agent-ready. MW-50 specifies that filing drafts cannot add that label.
   Sources: Linear MW-50, Acceptance Criteria; Day 3, p20.

6. Record a decline as a decision with a reason. A handled timestamp alone cannot
   show whether the request was resolved, deferred or rejected. Sources:
   `frontend/convex/admin.ts:744-750`; Linear MW-48, Acceptance Criteria.

7. Link a shipped item to the exact issue and merge. If a user asks what changed,
   the owner should be able to trace from the item to the reviewed revision and
   production check. Sources: Linear MW-47 and MW-48, Acceptance Criteria;
   `3 Skills/fde-skill/references/checklists.md:79-80`.

8. Draft the answer only after the release is verified. The service pack has an
   assistant prepare replies and a human send them; MW-48 applies that boundary
   to shipped feedback. Sources: `3 Skills/agent-skill-pack/08-customer-service/SKILL.md:1-3`;
   Linear MW-48, Acceptance Criteria.

9. Bring the reply back into the next Monday review: a customer may say the change
   missed the point, and that is new evidence for the next spec. Sources: Day 1 deck,
   slides 5.1 and 26.6; `3 Skills/fde-skill/SKILL.md:112-125`.

The three weekly numbers planned in MW-51 are **started, finished, came back**.
They need definitions before comparison: use a consistent week and count people,
not clicks, so repeated activity by one user does not become several people.
This is a proposed measurement rule, not a current metric. Sources: Linear MW-51,
Acceptance Criteria; `frontend/convex/admin.ts:102-112`; Day 1 deck, slide 17.5.

## 7. Build plan and boundary

These are separate, planned issues rather than changes made in MW-52. Source: Linear MW-47–MW-51
and MW-53, issue descriptions read 2 October.

| Issue | Smallest useful outcome |
|---|---|
| [MW-47](https://linear.app/software-factory-ai/issue/MW-47) | Put factory helpers and a reviewed-SHA merge gate in the repo; keep merge and deployment evidence. Source: MW-47, Acceptance Criteria. |
| [MW-48](https://linear.app/software-factory-ai/issue/MW-48) | Track in-app and outside feedback through status, linked issue, release and a reply Daryl sends. Source: MW-48, Acceptance Criteria. |
| [MW-49](https://linear.app/software-factory-ai/issue/MW-49) | Make user ratings candidate eval cases, with human confirmation before they enter the golden set. Source: MW-49, Acceptance Criteria. |
| [MW-50](https://linear.app/software-factory-ai/issue/MW-50) | Draft evidence-cited specs from open feedback, ratings and audit misses, behind the agent-ready gate. Source: MW-50, Acceptance Criteria. |
| [MW-51](https://linear.app/software-factory-ai/issue/MW-51) | Write the Monday listening runbook and show one status view of the loop. Source: MW-51, Acceptance Criteria. |
| [MW-53](https://linear.app/software-factory-ai/issue/MW-53) | Add the dated beta-user evidence to demo and positioning docs, as a paraphrase without a public quote. Source: MW-53, Acceptance Criteria. |

Out of scope for this audit: app code, factory scripts, eval data, tracker migrations, public
testimonials, app copy, pricing decisions and production changes. Those belong to the cited
follow-up issues or a later decision. Sources: MW-52 Non-goals; Linear MW-47–MW-51 and MW-53,
Acceptance Criteria.
