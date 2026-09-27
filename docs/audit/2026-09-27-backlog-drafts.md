# Audit backlog drafts — not filed in Linear

27 September 2026 · source commit `1749eab24d65cb3d4b5d3409b77c6aee3df3d0fd`.

Both Linear search and project lookup returned reauthentication-required. No duplicate search or comment review could complete; no issue, label, priority or status was changed. These drafts preserve confirmed findings under the owner's standing audit instruction. On reconnection: resolve the relevant project/team, inspect existing issues **and comments**, update a match or create only after deduplication, append the audit comment, then re-read. Never add operator-only `agent-ready`, approve evidence, or close work automatically.

Paths below are relative to `/Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher`; shorthand `checker.ts` and `watches.ts` mean `frontend/convex/`. Evidence: [record](2026-09-27-evidence.md), [raw tests](evidence-2026-09-27/commands.txt). Severity is audit judgment, not an applied Linear priority. A01–A06 are confirmed synthetic code behaviors; A07–A08 are observed contradictions; A09–A10 are existing documented gaps; A11–A12 are explicitly investigation/validation work, not invented legal or market conclusions.

## A01 — Recover failed alert delivery

**Severity:** High. **Disposition:** local draft, duplicate check blocked.

**Problem/evidence:** Mocked AgentMail 503 followed by the next hourly run produced one send attempt total; the alert remained failed. Source: `checker.ts:79–101,214–232`.

**Smallest scope:** Add a durable delivery outbox decoupled from seen-listing discovery, bounded retry/backoff, and reconciliation for ambiguous provider acceptance.

**Acceptance criteria**

- [ ] Definitive send failure is retried without rescoring
- [ ] accepted-but-response-lost behavior is documented and tested
- [ ] delivery status is visible to operations.

**Non-goals:** New alert channels or exactly-once guarantees unsupported by the provider.

**Verification/recorded review:** Replay lifecycle reproduction; add desired-behavior failure/recovery and ambiguous-ack tests; record one nonproduction end-to-end send.

**Dependencies:** A02 revision fencing for retry eligibility.

**Chronological audit comment to append when filed:**

> 2026-09-27 — Action: independent audit finding recorded locally; no implementation or Linear transition. Reason: recover failed alert delivery. Evidence: source commit above, cited paths and audit evidence. Acceptance criteria: all open, none waived. Remaining work: deduplicate, confirm issue scope, implement/review or investigate as specified. Approval/actor: Codex independent audit under Daryl's standing audit-to-backlog instruction; operator-ready approval not granted.

## A02 — Fence in-flight results against watch changes

**Severity:** High. **Disposition:** local draft, duplicate check blocked.

**Problem/evidence:** Archiving after claim still returned an email; changing the query let old results mark the new watch seeded. Source: `checker.ts:69–99; watches.ts:116–135,157–162`.

**Smallest scope:** Add watch revision/run identity and reject stale, paused or archived work at recording and delivery preparation.

**Acceptance criteria**

- [ ] Archive/pause suppresses queued work under a documented send-boundary policy
- [ ] old query results cannot seed a revised watch
- [ ] deletion remains safe.

**Non-goals:** Cancelling a provider delivery already irreversibly accepted.

**Verification/recorded review:** Replay archive/edit reproductions; test change between claim, record and send; record UI pause/edit plus resulting operational state.

**Dependencies:** Coordinate with A01/A05, independently test revisions.

**Chronological audit comment to append when filed:**

> 2026-09-27 — Action: independent audit finding recorded locally; no implementation or Linear transition. Reason: fence in-flight results against watch changes. Evidence: source commit above, cited paths and audit evidence. Acceptance criteria: all open, none waived. Remaining work: deduplicate, confirm issue scope, implement/review or investigate as specified. Approval/actor: Codex independent audit under Daryl's standing audit-to-backlog instruction; operator-ready approval not granted.

## A03 — Separate first-page parsing from ten-card display

**Severity:** High. **Disposition:** local draft, duplicate check blocked.

**Problem/evidence:** 11 synthetic eligible first-page rows remembered only 10 IDs; removing row1 made existing row11 appear fresh. Source: `agent.py:116,443–458`.

**Smallest scope:** Return full fetched results for baseline/deduplication; limit chat cards separately; explicitly queue/batch bounded scoring rather than discard rows.

**Acceptance criteria**

- [ ] All fetched eligible baseline IDs are remembered
- [ ] an old row moving into the first ten is never new
- [ ] an unseen row beyond ten can be processed
- [ ] updated cost measurement records increased workload.

**Non-goals:** Pagination, faster scraping or larger source access permissions.

**Verification/recorded review:** Replay parser reproduction and add >10/reordering/seen-first-ten regressions; update cost/report after model evaluation on permitted data.

**Dependencies:** A04 parser contract; A09 cost allowance must be recalibrated.

**Chronological audit comment to append when filed:**

> 2026-09-27 — Action: independent audit finding recorded locally; no implementation or Linear transition. Reason: separate first-page parsing from ten-card display. Evidence: source commit above, cited paths and audit evidence. Acceptance criteria: all open, none waived. Remaining work: deduplicate, confirm issue scope, implement/review or investigate as specified. Approval/actor: Codex independent audit under Daryl's standing audit-to-backlog instruction; operator-ready approval not granted.

## A04 — Treat extraction failure differently from an empty search

**Severity:** High. **Disposition:** local draft, duplicate check blocked.

**Problem/evidence:** Synthetic maintenance HTML yielded ok:true with empty IDs; code then seeds/clears errors. Source: `agent.py:79–86,457; checker.ts:99`.

**Smallest scope:** Define valid empty versus malformed/missing parser structure; return retryable failure and retain prior baseline.

**Acceptance criteria**

- [ ] Valid empty listing arrays remain successful
- [ ] missing/broken extraction raises a visible operational failure
- [ ] no false baseline seeding
- [ ] health reporting sees failures.

**Non-goals:** Bypassing upstream blocks or changing data source without review.

**Verification/recorded review:** Replay parser reproduction; change the existing malformed-JSON-as-empty contract test; exercise source-failure UI/health state in nonproduction.

**Dependencies:** None; source permission remains a separate gate.

**Chronological audit comment to append when filed:**

> 2026-09-27 — Action: independent audit finding recorded locally; no implementation or Linear transition. Reason: treat extraction failure differently from an empty search. Evidence: source commit above, cited paths and audit evidence. Acceptance criteria: all open, none waived. Remaining work: deduplicate, confirm issue scope, implement/review or investigate as specified. Approval/actor: Codex independent audit under Daryl's standing audit-to-backlog instruction; operator-ready approval not granted.

## A05 — Recover interrupted scheduled claims

**Severity:** Medium. **Disposition:** local draft, duplicate check blocked.

**Problem/evidence:** An interrupted weekly claim was not due after 31 minutes and next due seven days later. Source: `checker.ts:19–48`.

**Smallest scope:** Use an expiring claim lease with bounded recovery independent of normal caught HTTP exceptions.

**Acceptance criteria**

- [ ] Interrupted claims become eligible after the documented lease
- [ ] overlapping recovery does not duplicate alerts
- [ ] schedule moves only under explicit completion/failure policy.

**Non-goals:** Scheduler rewrite or unsupported exact-time promise.

**Verification/recorded review:** Replay interrupted-weekly-claim reproduction and exercise simulated worker termination/recovery.

**Dependencies:** Coordinate run identity with A02 and outbox idempotency with A01.

**Chronological audit comment to append when filed:**

> 2026-09-27 — Action: independent audit finding recorded locally; no implementation or Linear transition. Reason: recover interrupted scheduled claims. Evidence: source commit above, cited paths and audit evidence. Acceptance criteria: all open, none waived. Remaining work: deduplicate, confirm issue scope, implement/review or investigate as specified. Approval/actor: Codex independent audit under Daryl's standing audit-to-backlog instruction; operator-ready approval not granted.

## A06 — Provide a genuinely observational check preview

**Severity:** Medium. **Disposition:** local draft, duplicate check blocked.

**Problem/evidence:** Dry-run recorded seen/alert state; subsequent real check produced no email for the same listing. Source: `README.md:54; checker.ts:86–99,190,214,220`.

**Smallest scope:** Make preview read-only, or prohibit state-changing simulation against real data and provide a separate observational mode.

**Acceptance criteria**

- [ ] Preview leaves schedules, baselines, seen IDs and alerts unchanged
- [ ] later real run is unaffected
- [ ] docs explain any model cost.

**Non-goals:** Running diagnostics on production data during implementation review.

**Verification/recorded review:** Replay dry-run reproduction, compare database snapshots before/after, verify later real delivery remains eligible.

**Dependencies:** No dependency; keep this separately shippable.

**Chronological audit comment to append when filed:**

> 2026-09-27 — Action: independent audit finding recorded locally; no implementation or Linear transition. Reason: provide a genuinely observational check preview. Evidence: source commit above, cited paths and audit evidence. Acceptance criteria: all open, none waived. Remaining work: deduplicate, confirm issue scope, implement/review or investigate as specified. Approval/actor: Codex independent audit under Daryl's standing audit-to-backlog instruction; operator-ready approval not granted.

## A07 — Synchronize release claims and public launch drafts

**Severity:** Medium. **Disposition:** local draft, duplicate check blocked.

**Problem/evidence:** Drafts retain Vite, old test counts and no-eval claims; demo equates model-judge classification with email accuracy and overstates alert timeliness. Source: `docs/marketing/generated/linkedin-launch-post.md:66; linkedin-series.md:46,59,77; validation.md:41; docs/demo/demo-script.md:67–72`.

**Smallest scope:** Create dated commit-linked claim register and reconcile marketing/demo/current vault index; preserve superseded history.

**Acceptance criteria**

- [ ] Every stack/test/eval/cost/competitor/failure claim has current support
- [ ] 13/13 is qualified by sample/judge/recall
- [ ] owner confirms personal story
- [ ] English-everywhere versus agent.py:290 Dutch exception explicitly resolved.

**Non-goals:** Publishing, invented testimonials, new analytics, wholesale historical-note rewrite.

**Verification/recorded review:** Manual source-to-copy review, owner read-through and current demo recording; no mirror implementation tests.

**Dependencies:** A10 human evaluation status determines final wording.

**Chronological audit comment to append when filed:**

> 2026-09-27 — Action: independent audit finding recorded locally; no implementation or Linear transition. Reason: synchronize release claims and public launch drafts. Evidence: source commit above, cited paths and audit evidence. Acceptance criteria: all open, none waived. Remaining work: deduplicate, confirm issue scope, implement/review or investigate as specified. Approval/actor: Codex independent audit under Daryl's standing audit-to-backlog instruction; operator-ready approval not granted.

## A08 — Align privacy and deletion wording with actual data lifecycle

**Severity:** Medium. **Disposition:** local draft, duplicate check blocked.

**Problem/evidence:** Public text says nothing shared and all removed; actual OpenAI processing is disclosed nearby and Clerk deletion is separate. Chat/seen retention uses inactivity/last-seen clocks. Source: `frontend/src/Landing.jsx:77–79; frontend/src/views/PrivacySheet.jsx:12–15; frontend/convex/users.ts:60–74; checker.ts:245–250; RUNBOOK.md:93–96`.

**Smallest scope:** Document data classes, providers, retention clocks, local versus provider deletion, and operational request handling; update wording after review.

**Acceptance criteria**

- [ ] Truthful processor/sharing statement
- [ ] retention trigger per data class
- [ ] account/feedback-email copies covered explicitly
- [ ] deletion test records actual scope.

**Non-goals:** Claiming GDPR compliance without legal review; deleting real user data in tests.

**Verification/recorded review:** Seed synthetic user/chat/watch/feedback data; verify local deletion and documented provider handling; inspect rendered privacy copy.

**Dependencies:** Lawyer review for purposes, roles, rights and transfers; A07 claim synchronization.

**Chronological audit comment to append when filed:**

> 2026-09-27 — Action: independent audit finding recorded locally; no implementation or Linear transition. Reason: align privacy and deletion wording with actual data lifecycle. Evidence: source commit above, cited paths and audit evidence. Acceptance criteria: all open, none waived. Remaining work: deduplicate, confirm issue scope, implement/review or investigate as specified. Approval/actor: Codex independent audit under Daryl's standing audit-to-backlog instruction; operator-ready approval not granted.

## A09 — Isolate per-user expenditure and plan allowances

**Severity:** High before paid launch. **Disposition:** local draft, duplicate check blocked.

**Problem/evidence:** Instance-local chat limiter and shared model cap do not provide per-user monetary isolation; brief already names this gap. Source: `main.py:66–77; evals/report.md:106; frontend/convex/schema.ts`.

**Smallest scope:** Persistent per-user budget reservations and reconciled usage across chat/scoring, plus honest exhaustion states and cost-based allowances.

**Acceptance criteria**

- [ ] Concurrent instances cannot overdraw allowance under documented tolerance
- [ ] retries accounted
- [ ] one exhausted user does not halt others
- [ ] provider hard-limit configuration verified without spending to cap.

**Non-goals:** Analytics/events for marketing; complex model router.

**Verification/recorded review:** Concurrent mocked requests, reservation release/reconciliation and cross-user tests; snapshot token-cost assumptions.

**Dependencies:** A03 changes workload; deduplicate against existing budget work when Linear reconnects.

**Chronological audit comment to append when filed:**

> 2026-09-27 — Action: independent audit finding recorded locally; no implementation or Linear transition. Reason: isolate per-user expenditure and plan allowances. Evidence: source commit above, cited paths and audit evidence. Acceptance criteria: all open, none waived. Remaining work: deduplicate, confirm issue scope, implement/review or investigate as specified. Approval/actor: Codex independent audit under Daryl's standing audit-to-backlog instruction; operator-ready approval not granted.

## A10 — Approve evaluation ground truth and acceptance conditions

**Severity:** Medium. **Disposition:** local draft, duplicate check blocked.

**Problem/evidence:** Judge confirmation is pending; known model/price-boundary disagreements exist. Source: `evals/report.md:3,69–72; evals/data/spotcheck.md`.

**Smallest scope:** Human-approve relevance policy, judge labels and chat assertions; preserve prior runs and report categories/threshold tradeoffs on unseen cases.

**Acceptance criteria**

- [ ] Named/date sign-off
- [ ] inclusive-price/variant/older-model policy explicit
- [ ] pending labels never called hand-labelled
- [ ] actual-versus-expected loops and category counts reported.

**Non-goals:** Tuning solely to 49 examples; fabricated performance improvement or confidence calibration.

**Verification/recorded review:** Blind human review, frozen dataset/model/prompt versions and recorded eval run; state measurement limits.

**Dependencies:** Owner/reviewer participation; no label approval inferred from this audit.

**Chronological audit comment to append when filed:**

> 2026-09-27 — Action: independent audit finding recorded locally; no implementation or Linear transition. Reason: approve evaluation ground truth and acceptance conditions. Evidence: source commit above, cited paths and audit evidence. Acceptance criteria: all open, none waived. Remaining work: deduplicate, confirm issue scope, implement/review or investigate as specified. Approval/actor: Codex independent audit under Daryl's standing audit-to-backlog instruction; operator-ready approval not granted.

## A11 — Choose and document a lawful commercial data route

**Severity:** Launch blocker; investigation. **Disposition:** local draft, duplicate check blocked.

**Problem/evidence:** Project accepts systematic-querying risk for free portfolio use; no paid-use permission is evidenced. Source: `README.md:97; docs/audit/2026-09-27-evidence.md primary-source table`.

**Smallest scope:** Investigate written permission/partner buyer access if available, licensed alternative, or user-provided saved-search inputs; counsel reviews rights and proposed use.

**Acceptance criteria**

- [ ] Dated go/no-go record with applicable terms, allowed scope and evidence
- [ ] if no viable source, paid plan stops or pivots.

**Non-goals:** Scraping expansion, automatic claim of legal exemption, committing to contracts.

**Verification/recorded review:** Document review with counsel; test feasible chosen source on permitted sample only after route is approved.

**Dependencies:** External owner/counsel response. Check existing issues/comments before creating.

**Chronological audit comment to append when filed:**

> 2026-09-27 — Action: independent audit finding recorded locally; no implementation or Linear transition. Reason: choose and document a lawful commercial data route. Evidence: source commit above, cited paths and audit evidence. Acceptance criteria: all open, none waived. Remaining work: deduplicate, confirm issue scope, implement/review or investigate as specified. Approval/actor: Codex independent audit under Daryl's standing audit-to-backlog instruction; operator-ready approval not granted.

## A12 — Test the buyer mission and bounded offer before billing build

**Severity:** Medium; discovery. **Disposition:** local draft, duplicate check blocked.

**Problem/evidence:** No own-user validation evidence; offer/products/FAQs missing and persona is inferred. Source: `docs/marketing/generated/validation.md:45–53; buyer-avatar.md:77; docs/marketing/index.md:27–40`.

**Smallest scope:** Run the existing interviews/beta plan, operating map and five-component offer; choose finite mission versus subscription based on evidence; model all-in contribution.

**Acceptance criteria**

- [ ] Actual past behavior and pilot outcomes recorded with consent
- [ ] price remains hypothesis until commitment
- [ ] dated persist/pivot/stop decision
- [ ] product/support/FAQ summary
- [ ] commercial hosting/legal/billing prerequisites explicit.

**Non-goals:** Invented conversion target achievement, new tracking/A-B tests, outreach performed by this audit.

**Verification/recorded review:** Observed user task and manually recorded useful/missed alerts; actual payment only after A11 and service/legal readiness; source-qualified case study.

**Dependencies:** A11 before accepting money; A01–A10 as relevant before paid pilot.

**Chronological audit comment to append when filed:**

> 2026-09-27 — Action: independent audit finding recorded locally; no implementation or Linear transition. Reason: test the buyer mission and bounded offer before billing build. Evidence: source commit above, cited paths and audit evidence. Acceptance criteria: all open, none waived. Remaining work: deduplicate, confirm issue scope, implement/review or investigate as specified. Approval/actor: Codex independent audit under Daryl's standing audit-to-backlog instruction; operator-ready approval not granted.


