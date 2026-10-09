# Marktplaats Watcher: independent FDE and marketing audit

27 September 2026 · commit `1749eab24d65cb3d4b5d3409b77c6aee3df3d0fd`

**Judgment:** keep the stack. The portfolio has credible engineering evidence; the paid product needs source permission, reliable delivery and demonstrated customer value before billing. The highest-value LinkedIn improvement is to reconcile the story with the current release. These are recommendations based on [evals/report.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:3>), [docs/marketing/generated/validation.md:45](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/generated/validation.md:45>) and the reproduced defects in [docs/audit/2026-09-27-evidence.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-evidence.md>).

The [read manifest](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-read-manifest.md>) was supplied before drafting. No environment files were opened. Independent offline checks passed **54 JS and 29 Python tests**; current-commit CI passed. Additional synthetic checks reproduced defects; they do not establish production incident frequency. Signed-in production flows and model evaluations were not rerun. [docs/audit/2026-09-27-evidence.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-evidence.md>)

## 1. Scorecard

All **59 items**, in the original order of [F/references/checklists.md](</Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill/references/checklists.md>). ✅ supported; ⚠️ partial/unverified/contextual; ❌ confirmed missing artifact/activity or failed requirement. No aggregate score: factory and enterprise-network requirements are contextual. Shortened labels preserve the original requirements.

| §1 Operating map | Status | Evidence / gap |
|---|---|---|
| 1.1 Observe actual operator and exceptions | ❌ | Interview not run. [docs/marketing/references/onboarding.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/references/onboarding.md:3>) |
| 1.2 Interrogate underlying question | ⚠️ | Clear pain, inferred from research. [docs/demo/problem-statement.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/problem-statement.md:3>) |
| 1.3 Draw current/future workflow | ⚠️ | Prose and technical diagram; no observed operator map. [README.md:14](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/README.md:14>) |
| 1.4 Select one value-led use case | ⚠️ | Specific-item hunter selected; value unvalidated. [docs/marketing/generated/buyer-avatar.md:8](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/generated/buyer-avatar.md:8>) |
| 1.5 Write may/may-not boundaries | ✅ | Save approval and explicit limits. [README.md:5](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/README.md:5>) |
| 1.6 Quantify customer value | ❌ | Transformation unmeasured. [docs/marketing/generated/validation.md:20](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/generated/validation.md:20>) |
| 1.7 Split LLM/deterministic steps | ✅ | Filters/code, scoring/model. [agent.py:79](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/agent.py:79>) |
| 1.8 Network permission/residency | ⚠️ | Cloud flow disclosed; residency unverified. [README.md:100](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/README.md:100>) |

| §2 Definition of done | Status | Evidence / gap |
|---|---|---|
| 2.1 Reachable without laptop | ✅ | Public landing observed. [docs/audit/2026-09-27-evidence.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-evidence.md>) |
| 2.2 Pipeline tests pass | ✅ | Current-commit CI verified. [docs/audit/evidence-2026-09-27/ci-run.json](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/evidence-2026-09-27/ci-run.json>) |
| 2.3 Vaulted secrets; clean code/history | ⚠️ | CI scan passed; deployed storage not inspected. [DEPLOY-VERCEL.md:16](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/DEPLOY-VERCEL.md:16>) |
| 2.4 Errors reach a human | ✅ | Logs/digest implemented; blind spots remain. [frontend/convex/health.ts:45](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/frontend/convex/health.ts:45>) |
| 2.5 Independent redeployment | ⚠️ | Instructions, no independent rehearsal. [DEPLOY-VERCEL.md:40](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/DEPLOY-VERCEL.md:40>) |
| 2.6 Customer has seen it | ⚠️ | No own-user evidence recorded. [docs/marketing/references/testimonials.md:9](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/references/testimonials.md:9>) |

| §3 Evaluation | Status | Evidence / gap |
|---|---|---|
| 3.1 ≥20 cases; hand-labelled ideals | ⚠️ | 20 chats/49 listings; human labels pending. [evals/report.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:3>) |
| 3.2 Human-authored assertions | ⚠️ | Conditions exist; human approval unrecorded. [evals/chat_cases.py:24](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/chat_cases.py:24>) |
| 3.3 Numeric pass rate | ✅ | 20/20 and confusion matrices (27 Sep 2026 snapshot). [evals/report.md:9](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:9>) |
| 3.4 Count failure categories | ⚠️ | Individual misses; no category summary. [evals/report.md:16](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:16>) |
| 3.5 Actual/expected loop counts | ✅ | Tool limits and model-call counts. [evals/report.md:44](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:44>) |
| 3.6 Uncertainty/risk → human | ⚠️ | Writes need approval; relevance score ≠ confidence. [agent.py:380](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/agent.py:380>) |
| 3.7 Named, dated UAT | ⚠️ | Human spot-check still blank. [evals/data/spotcheck.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/data/spotcheck.md:3>) |

| §4 Security | Status | Evidence / gap |
|---|---|---|
| 4.1 Enumerate MCP egress | ⚠️ | Contextual: no runtime MCP. [docs/system-design.html:215](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/system-design.html:215>) |
| 4.2 Tool access/default deny | ⚠️ | Fixed destinations; no network enforcement. [agent.py:45](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/agent.py:45>) |
| 4.3 Four sandbox layers | ⚠️ | Docker non-root ≠ Vercel network policy. [Dockerfile:27](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/Dockerfile:27>) |
| 4.4 FQDN/port allowlist; appropriate VPN | ❌ | Allowlist missing; consumer VPN unnecessary. [docs/system-design.html:229](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/system-design.html:229>) |
| 4.5 Injection posture | ✅ | Untrusted titles, constrained capabilities. [agent.py:288](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/agent.py:288>) |
| 4.6 Rotation/clean history | ⚠️ | Procedure/CI; old Azure rotation pending. [docs/demo/pre-demo-checklist.md:20](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/pre-demo-checklist.md:20>) |
| 4.7 Every step auditable | ⚠️ | Aggregate logs, no durable correlated trace. [main.py:120](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/main.py:120>) |
| 4.8 Written data-to-model flow | ⚠️ | Disclosure incomplete versus actual context. [agent.py:323](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/agent.py:323>) |

| §5 Pre-demo | Status | Evidence / gap |
|---|---|---|
| 5.1 Uncontrolled network | ⚠️ | Mobile-data check pending. [docs/demo/pre-demo-checklist.md:8](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/pre-demo-checklist.md:8>) |
| 5.2 Hook in 2–3 seconds | ⚠️ | Clear sentence; comprehension untested. [frontend/src/Landing.jsx:35](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/frontend/src/Landing.jsx:35>) |
| 5.3 Loading/empty/error states | ✅ | Implemented state inventory. [docs/demo/pre-demo-checklist.md:10](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/pre-demo-checklist.md:10>) |
| 5.4 No exposed secrets/client data | ⚠️ | CI scan; authenticated screens unreviewed. [docs/demo/pre-demo-checklist.md:12](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/pre-demo-checklist.md:12>) |
| 5.5 Revoke access | ✅ | Shutdown/rotation procedures. [RUNBOOK.md:26](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/RUNBOOK.md:26>) |
| 5.6 Tested rollback | ⚠️ | Procedure exists; drill pending. [docs/demo/pre-demo-checklist.md:16](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/pre-demo-checklist.md:16>) |
| 5.7 State monthly/user cost | ✅ | Per-watch scenarios in demo. [evals/report.md:96](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:96>) |
| 5.8 Rehearse engineer/VP versions | ⚠️ | Scripts exist; rehearsal pending. [docs/demo/pre-demo-checklist.md:18](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/pre-demo-checklist.md:18>) |

| §6 Token economics | Status | Evidence / gap |
|---|---|---|
| 6.1 Context token shares | ⚠️ | Totals measured, shares absent. [evals/report.md:76](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:76>) |
| 6.2 Bounded retries/loops/kill switch | ⚠️ | Model bounds; scheduler crash recovery missing. [frontend/convex/checker.ts:36](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/frontend/convex/checker.ts:36>) |
| 6.3 Strong planning/cheap execution | ⚠️ | Cheap runtime/strong judge; planning unrecorded. [evals/report.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:3>) |
| 6.4 Compact conversation restarts | ⚠️ | Truncation, not summaries; need unproven. [frontend/src/lib/history.js:1](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/frontend/src/lib/history.js:1>) |
| 6.5 Attribute cost per work item | ✅ | Per-question/listing/watch measurements. [evals/report.md:74](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:74>) |

| §7 Second brain | Status | Evidence / gap |
|---|---|---|
| 7.1 raw/wiki/root identity contract | ❌ | Missing in scoped vault inspection. [docs/audit/2026-09-27-read-manifest.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-read-manifest.md>) |
| 7.2 Tested read/write boundary | ⚠️ | No contract/test record. [docs/audit/2026-09-27-evidence.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-evidence.md>) |
| 7.3 Auto-linked graph page | ⚠️ | Links exist; creation provenance unverified. [V/Home.md:9](</Users/daryldimitrianthony/FDE Course/FDE Vault/Home.md:9>) |
| 7.4 Separate project/business vault | ✅ | Product marketing vault exists. [docs/marketing/index.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/index.md:3>) |
| 7.5 Identity/update rules | ❌ | Missing identity; stale v1 gaps remain. [V/MVP Gaps.md:10](</Users/daryldimitrianthony/FDE Course/FDE Vault/MVP Gaps.md:10>) |

| §8 Software factory | Status | Evidence / gap |
|---|---|---|
| 8.1 Staged root runbook | ⚠️ | Absent; optional factory enrollment. [docs/audit/2026-09-27-read-manifest.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-read-manifest.md>) |
| 8.2 Stage skills | ⚠️ | Absent; contextual requirement. [docs/audit/2026-09-27-read-manifest.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-read-manifest.md>) |
| 8.3 Machine gate | ✅ | CI checks executed successfully. [docs/audit/evidence-2026-09-27/ci-run.json](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/evidence-2026-09-27/ci-run.json>) |
| 8.4 Failed gate → Build | ⚠️ | Checks present; routing absent. [.github/workflows/ci.yml:8](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/.github/workflows/ci.yml:8>) |
| 8.5 Readable diff/audit review | ⚠️ | Eval history; no recurring review bundle. [evals/report.md:67](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:67>) |
| 8.6 Ship decision/reviewer note | ⚠️ | Release narrative; reviewer not named. [docs/system-design.html:612](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/system-design.html:612>) |

| §9 Pitch | Status | Evidence / gap |
|---|---|---|
| 9.1 Repeatable one-sentence idea | ✅ | Plain-language promise. [README.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/README.md:3>) |
| 9.2 Real discovery | ❌ | User evidence absent. [docs/marketing/generated/validation.md:11](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/generated/validation.md:11>) |
| 9.3 Demoable MVP | ✅ | Deployed app and demo paths. [docs/demo/demo-script.md:12](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/demo-script.md:12>) |
| 9.4 Revenue/risk/cost value | ⚠️ | Benefits described, unquantified. [docs/demo/problem-statement.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/problem-statement.md:3>) |
| 9.5 Public validation before expansion | ⚠️ | Draft posts ≠ observed validation. [docs/marketing/index.md:29](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/index.md:29>) |
| 9.6 Named pivot/persist point | ⚠️ | Proposed beta, no dated decision criteria. [docs/marketing/generated/validation.md:52](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/generated/validation.md:52>) |

## 2. Top 10 upgrades

**Advice:** ordinal impact÷effort ranking, not invented numerical ROI. Assumption: relative effort is S = one focused change, M = coordinated changes, L = external dependencies/multiple subsystems; no delivery-time estimate is implied. Legal clearance is a prerequisite regardless of rank.

| Rank | Problem → concrete change | Evidence | Course/pack source | Effort; version |
|---|---|---|---|---|
| 1 | Broken pages appear healthy → validate parser structure; preserve baseline and surface failure. | [agent.py:79](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/agent.py:79>); evidence A04 | [F/references/checklists.md:21](</Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill/references/checklists.md:21>) | S; MVP/Portfolio |
| 2 | Ten-card UI limit corrupts newness → seed/dedupe all fetched first-page rows; cap display separately. | [agent.py:116](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/agent.py:116>); A03 | [F/references/agent-engineering.md:42](</Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill/references/agent-engineering.md:42>) | S; MVP/Portfolio |
| 3 | Stale/overstated claims → one dated release-claims register; synchronize launch/demo/privacy copy and vault. | [docs/marketing/generated/linkedin-launch-post.md:66](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/generated/linkedin-launch-post.md:66>); A07–08 | [M/05-copywriter/references/long-form-frameworks/proof.md:42](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/05-copywriter/references/long-form-frameworks/proof.md:42>) | S; all |
| 4 | Buyer value unproven → observe real buying tasks; draw before/after workflow; record pilot outcomes and purchasing decisions manually. | [docs/marketing/generated/validation.md:45](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/generated/validation.md:45>) | [F/SKILL.md:33](</Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill/SKILL.md:33>); [M/10-product-builder/knowledge-base/product-validatie.md](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/10-product-builder/knowledge-base/product-validatie.md>) | S; all |
| 5 | Failed emails disappear permanently → durable outbox, bounded retry, provider-acceptance reconciliation; make preview non-mutating. | [frontend/convex/checker.ts:79](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/frontend/convex/checker.ts:79>); A01/A06 | [F/references/checklists.md:21](</Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill/references/checklists.md:21>) | M; MVP/Portfolio |
| 6 | Stale jobs send/reseed; crashes skip runs → revision fencing, expiring leases, active-state check before delivery. | [frontend/convex/checker.ts:36](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/frontend/convex/checker.ts:36>); A02/A05 | [F/references/checklists.md:60](</Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill/references/checklists.md:60>) | M; MVP/Portfolio |
| 7 | Judge and relevance policy unresolved → human-approve labels/assertions; separate product match from deal quality; test unseen cases. | [evals/report.md:71](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:71>); [agent.py:396](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/agent.py:396>) | [F/SKILL.md:68](</Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill/SKILL.md:68>) | M; all |
| 8 | Shared budget and instance-local limits → persistent per-user reservations/usage across chat and watches; explicit exhausted state. | [main.py:66](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/main.py:66>); [evals/report.md:106](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:106>) | [F/references/agent-engineering.md:62](</Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill/references/agent-engineering.md:62>) | M; MVP |
| 9 | Recovery/handover unproven → recorded fault/rollback drill, enforced CSP after compatibility checks, redacted trace and independent runbook use. | [docs/demo/pre-demo-checklist.md:16](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/pre-demo-checklist.md:16>) | [F/references/checklists.md:46](</Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill/references/checklists.md:46>) | M; Portfolio/MVP |
| 10 | No commercial contract → clear lawful source first, then one bounded offer, entitlements, payment lifecycle and staffed support. | [docs/audit/chatgpt-deep-audit-brief.md:58](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/chatgpt-deep-audit-brief.md:58>) | [M/03-strategist/SKILL.md:49](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/03-strategist/SKILL.md:49>) | L; MVP |

A01–08 are reproduced/documented in [docs/audit/2026-09-27-evidence.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-evidence.md>). No implementation was performed. Linear reauthentication blocked deduplication and filing; [docs/audit/2026-09-27-backlog-drafts.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-backlog-drafts.md>) preserves actionable drafts, not created issues.

## 3. Smallest path to paid

**First, resolve the source. Check with a lawyer.** Articles 7.1–7.3 address copying, systematic extraction and advertisement linking; being free or `noindex` is not permission. Obtain written permission/licensed partner access **if available**; otherwise assess a licensed alternative source, or processing user-provided saved-search emails. The latter still needs rights/privacy review and inherits the source's delivery delay. Stop charging plans if no defensible route exists. [README.md:97](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/README.md:97>); [docs/audit/2026-09-27-evidence.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-evidence.md>); [Marktplaats terms](https://www.marktplaats.nl/i/help/over-marktplaats/voorwaarden-en-privacybeleid/algemene_voorwaarden_marktplaats_7.pdf).

Then, in order:

1. **Validate a narrow buying mission.** Assumption: occasional specific-item hunters may prefer a finite purchase to recurring billing. Compare these arrangements in the existing beta/interview plan; a €2/€5/€10+ poll response is not payment. [docs/marketing/generated/buyer-avatar.md:77](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/generated/buyer-avatar.md:77>); [frontend/convex/schema.ts:18](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/frontend/convex/schema.ts:18>).
2. **Make the service dependable.** Complete upgrades 1–2 and 5–8; disclose first-page/location limits, baseline silence and schedule tolerance. Relevance scoring must not imply verified market valuation: the current prompt requests “typical price” without comparable-price evidence. [agent.py:396](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/agent.py:396>); [README.md:91](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/README.md:91>).
3. **Prepare the business. Check with a lawyer/accountant:** existing KVK/VAT coverage, consumer terms, immediate service commencement, 14-day withdrawal/refunds, privacy purposes/processors/transfers and deletion. Name Vercel, Convex, Clerk, OpenAI and AgentMail with verified roles/locations; distinguish Convex deletion from Clerk and email copies. Include the online withdrawal-button requirement in legal review. [RUNBOOK.md:93](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/RUNBOOK.md:93>); [docs/audit/2026-09-27-evidence.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-evidence.md>); [government guidance](https://business.gov.nl/amendments/online-shops-must-have-cancellation-button/).
4. **Launch one bounded paid plan.** Recommendation: capped active watches and scoring allowance, hourly-or-slower schedules initially; self-service pause/cancel, clear exhaustion notices, no surprise overages. Add hosted checkout, signed/idempotent webhooks, server-side entitlements and reconciliation for payment success/failure/cancellation/refund. Test lifecycle and cross-user access in a payment sandbox. [frontend/convex/schema.ts:78](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/frontend/convex/schema.ts:78>); [docs/audit/chatgpt-deep-audit-brief.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/chatgpt-deep-audit-brief.md>).
5. **Operate it commercially.** Own domain, Clerk production, authenticated sender, monitored reply/support inbox, escalation owner and rollback evidence. Verify commercial hosting terms: the report's free-tier assumption cannot simply carry into paid use; Vercel Hobby is noncommercial. [evals/report.md:106](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:106>); [frontend/convex/checker.ts:148](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/frontend/convex/checker.ts:148>); [Vercel policy](https://vercel.com/docs/plans/hobby).

Apply the strategist's **Five Components** precisely; these are proposed offer terms, not existing capabilities. [M/03-strategist/SKILL.md:49](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/03-strategist/SKILL.md:49>)

| Component | Proposed offer |
|---|---|
| Promise | An explained shortlist for one specified buying mission; no guaranteed bargain, availability or complete coverage. |
| Payment terms | Total price, duration, allowances, renewal/cancellation and remedies disclosed before purchase. |
| Plan/mechanism | Describe and approve → check and assess → email evidence and decide. |
| Genuine scarcity/urgency | Only actual support/capacity constraints; omit fabricated countdowns. |
| Risk reversal | Remedy for failure to deliver the stated service, reviewed legally; no purchase-success guarantee. |

The **Value Equation** is (outcome × perceived likelihood) / (delay × effort). Assumption: likelihood is weakest: user proof and human label review are missing. Improve trust through witnessed outcomes and recovery; explain baseline silence; keep the existing plain-language setup. [M/03-strategist/SKILL.md:79](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/03-strategist/SKILL.md:79>); [evals/report.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:3>).

**Price from contribution, not token cost.** Measured monthly scoring is €0.35/€1.96 per hourly watch and €1.38/€7.82 per 15-minute watch in the report's two workloads. Five watches therefore cost **€1.75/€9.80** or **€6.90/€39.10**, respectively: arithmetic scenarios, not new measurements or guaranteed ceilings. [evals/report.md:96](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:96>)

Net revenue must cover scoring + chats + retries + source rights + commercial hosting + payment fees + support + refunds, after applicable tax treatment, plus the owner's margin. Set price only after measuring these. Remeasure after fixing truncation. Verify explicit provider hard-limit enforcement; a spend alert alone is insufficient. [docs/audit/2026-09-27-evidence.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-evidence.md>); [OpenAI controls](https://developers.openai.com/api/docs/guides/spend-limits).

## 4. Marketing Engineering plan

**Advice:** bind every agent to this project's `docs/marketing/`; the pack's default `_vault` is unpopulated. Preserve English and the separate app/LinkedIn audiences. [docs/marketing/index.md:7](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/index.md:7>); [M/_vault/index.md:9](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/_vault/index.md:9>)

| Order | Agent → deliverable |
|---|---|
| 1 | **01 Commander:** status/dependency plan and claims needing review; planning, not vault authorship. [M/01-commander/CLAUDE.md:9](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/01-commander/CLAUDE.md:9>) |
| 2 | **02 Onboarding:** actual owner interview, voice ratings, approved origin story. [M/02-onboarding/SKILL.md:26](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/02-onboarding/SKILL.md:26>) |
| 3 | **04 Researcher → 02 Onboarding:** dated competitor/native-search verification plus interview/testimonial references; “not visible” never becomes “does not exist.” [M/04-researcher/SKILL.md:198](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/04-researcher/SKILL.md:198>) |
| 4 | **03 Strategist:** evidence-based avatar; awareness stage labelled assumption. Keep LinkedIn's hiring/client audience separate. [M/03-strategist/SKILL.md:118](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/03-strategist/SKILL.md:118>) |
| 5 | **10 Product Builder:** who/what/why you/why now, validation ladder, go/revise/stop. Adapt its validation method to SaaS. [M/10-product-builder/knowledge-base/product-validatie.md](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/10-product-builder/knowledge-base/product-validatie.md>) |
| 6 | **03 Strategist → 10 Product Builder:** conditional `generated/offer-stack.md` and `products/marktplaats-watcher.md`. [M/03-strategist/CLAUDE.md:73](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/03-strategist/CLAUDE.md:73>) |
| 7 | **08 Customer Service → 05 Copywriter:** `faqs/`, support/escalation policy, then reconcile existing landing/email/privacy deck. [M/08-customer-service/CLAUDE.md:14](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/08-customer-service/CLAUDE.md:14>) |
| 8 | **06 Content Creator → 01 Commander:** refresh calendar, drafts, alternative hooks, visuals and readiness review. [M/06-content-creator/CLAUDE.md:76](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/06-content-creator/CLAUDE.md:76>) |

Missing offer/products/FAQs are explicitly listed in [docs/marketing/index.md:27](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/index.md:27>). Add a canonical calendar pointer, not a duplicate calendar. Defer **07 Ads** and **09 programmatic SEO**: no A/B/analytics and `noindex` are owner decisions. Use SEO only for metadata/readability. [docs/audit/chatgpt-deep-audit-brief.md:73](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/chatgpt-deep-audit-brief.md:73>)

**Before the first post on 29 September:** reconcile claims, redact assets and resolve owner placeholders; otherwise delay that post. [docs/marketing/generated/linkedin-launch-post.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/generated/linkedin-launch-post.md>)

Revise the existing sequence: **29 Sep** Cisco-switch story; **30 Sep** prompt failure/code restriction; **1 Oct** schedule UX; **2 Oct** silent baseline/coverage; **5 Oct** actual demo learning; **6 Oct** evaluation trade-off; **7 Oct** costs/budgets; **9 Oct** architecture, recovery and handover case study. These are proposed topics, not claims the future events happened. [docs/marketing/generated/linkedin-series.md:30](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/generated/linkedin-series.md:30>)

Follow the dedicated LinkedIn rules: **500–1,200 characters**, standalone ~150-character hook, one idea, short paragraphs, no hashtags/em dashes, “Only You” detail, ≥3/5 anti-boring checks, two alternative hooks and a meaningful standalone visual. First-comment links are a pack convention, not a verified algorithm guarantee. [M/06-content-creator/knowledge-base/linkedin/writing-rules.md](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/06-content-creator/knowledge-base/linkedin/writing-rules.md>); [M/06-content-creator/knowledge-base/platform-guides/linkedin.md](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/06-content-creator/knowledge-base/platform-guides/linkedin.md>)

Prepare a redacted current demo recording, annotated alert, evaluation card and simple architecture/decision image. Say **“13/13 selected positives matched the model judge; 68% recall on 49 frozen listings; human check pending”**, not “every email was right.” Refresh Vite/43-test/no-eval drafts and obtain permission for user quotes. [evals/report.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:3>); [docs/marketing/generated/linkedin-launch-post.md:66](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/generated/linkedin-launch-post.md:66>); [docs/marketing/references/testimonials.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/references/testimonials.md>)

## 5. Waves

**Before the 3 October demo:** complete the pending mobile-network check, human spot-check, rollback drill and both rehearsals; report any unfinished check honestly. [docs/demo/pre-demo-checklist.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/pre-demo-checklist.md>)

**Proposed acceptance criteria, not promised outcomes.** Demo-day date comes from [docs/audit/chatgpt-deep-audit-brief.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/chatgpt-deep-audit-brief.md>); priorities follow §2 evidence.

| Wave | Acceptance criteria | Non-goals |
|---|---|---|
| **Wave 2: 4–10 October** | Record source/legal decision owner; human-review labels; corrected claims register; parser/truncation regressions pass; delivery/lifecycle issues scoped; observed operator workflow and dated pilot decision criteria; record recovery evidence. | Payments before source clearance; more management UI; new channels. |
| **Wave 3: by 27 October** | Outbox, lease/revision, preview and budget tests pass; witnessed end-to-end alert and failure recovery; lawful source documented; offer tested with real commitments; commercial/legal/support checklist reviewed; payment lifecycle verified if proceeding. Publish independently usable case study/runbook. | Guaranteed PMF; automated outreach; analytics/A-B; indexation. |
| **Later** | Add Telegram → Discord → WhatsApp only after demonstrated need. Version historical vault sources and current synthesis. Optional offline TypeSafe relevance/confidence benchmark against human labels, measuring cost/latency and preserving explanations. Add summaries/factory automation only for demonstrated recurring failures/work. | Stack rewrite, LangGraph/MCP/Kubernetes or a full factory for portfolio decoration. |

Sources: [F/SKILL.md:120](</Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill/SKILL.md:120>), [F/references/second-brain-and-startup.md:9](</Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill/references/second-brain-and-startup.md:9>), [M/10-product-builder/knowledge-base/product-validatie.md](</Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/10-product-builder/knowledge-base/product-validatie.md>), [docs/audit/chatgpt-deep-audit-brief.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/chatgpt-deep-audit-brief.md>). TypeSafe benefits are unmeasured here; current documentation is recorded in [docs/audit/2026-09-27-evidence.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/2026-09-27-evidence.md>).

## 6. Risks and one-line owner questions

1. **Source continuity:** which counsel-reviewed route will you pursue: permission/partner access, licensed alternative, or user-provided inputs? [README.md:97](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/README.md:97>)
2. **Priority:** is the next month's primary outcome hiring/client conversations or a paid consumer pilot? [docs/marketing/index.md:7](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/index.md:7>)
3. **Buyer commitment:** who are the first real hunters, and on what date will you decide persist, pivot or stop? [docs/marketing/generated/validation.md:52](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/marketing/generated/validation.md:52>)
4. **Economics:** what support capacity and minimum contribution make a bounded offer worth operating? [evals/report.md:106](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.md:106>)
5. **Human ownership:** who signs off labels/UAT and owns support, incidents and refunds? [evals/data/spotcheck.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/data/spotcheck.md:3>); [frontend/convex/checker.ts:148](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/frontend/convex/checker.ts:148>)
