# Round 2 files actually read

Prepared before drafting the follow-up audit. Paths are relative to `/Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher` unless prefixed F (`/Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill`) or M (`/Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack`). This combines the root reviewer and three independent reviewers; it does not imply every reviewer read every file.

## Full manual reads this round

- `docs/audit/chatgpt-followup-audit-brief.md` (first project read)
- `docs/demo/human-checks-agent-brief.md`
- `README.md`, `RUNBOOK.md`
- `frontend/AGENTS.md`, `frontend/CLAUDE.md`, `vercel.json`, `.gitignore`
- `docs/demo/demo-script.md`, `docs/demo/pre-demo-checklist.md`
- `evals/report.md`, `evals/report.py`, `evals/common.py`, `evals/label.py`, `evals/cost.py`, `evals/run_scorer.py`, `evals/data/spotcheck.md`
- `frontend/convex/checker.ts`, `checker.test.ts`, `health.ts`, `crons.ts`, `feedback.ts`, `feedback.test.ts`
- `frontend/src/Landing.jsx`, `frontend/src/views/PrivacySheet.jsx`, `frontend/src/views/FeedbackSheet.jsx`, `frontend/src/components/ListingCard.jsx`
- `.github/workflows/uptime.yml`
- `docs/marketing/generated/linkedin-launch-post.md`, `linkedin-series.md`, `validation.md`
- `docs/marketing/competitors/mpalerts.md`, `marktalert.md`
- `docs/audit/2026-09-27-evidence.md` (historical context)
- `docs/audit/evidence-2026-09-27/commands.txt`, `replay.py`, `parse_repro.py`, `convex/audit-repro.test.ts`, `python/run_offline.py`, `vitest.config.ts`
- F: `references/checklists.md`, `references/second-brain-and-startup.md`
- M: `06-content-creator/knowledge-base/linkedin/writing-rules.md`, `06-content-creator/knowledge-base/platform-guides/linkedin.md`, `10-product-builder/knowledge-base/product-validatie.md`

## Excerpts manually inspected this round

- `docs/audit/chatgpt-deep-audit-2026-09-27.md`: scorecard lines 9–100, and priorities/paid/marketing/waves sections. Earlier round-one reads remain in its manifest.
- `agent.py`: 1–185, 392–480 and changed lines versus 1749eab.
- `main.py`: 90–205, CheckWatch class, and changed lines versus 1749eab.
- `frontend/convex/watches.ts`: 1–195.
- `frontend/convex/schema.ts`: 1–55 and changed lines versus 1749eab.
- `test_agent.py`: final 110 lines.
- `frontend/src/views/ChatView.jsx`: 1–100.
- `frontend/convex/users.ts`: feedback-deletion matches.
- `docs/system-design.html`: 547–590 and Cisco/evaluation matches.
- `docs/marketing/references/testimonials.md`: 90–105.
- `docs/marketing/references/brand-voice.md`: 91–133 and Cisco matches.
- `docs/marketing/references/onboarding.md`, `research.md`: Cisco matches only.
- `docs/marketing/competitors/marktplaats-saved-search.md`: native-alert frequency evidence around 24–26.
- F: `SKILL.md`: 68–138; `references/agent-engineering.md`: focused sections including 42–69.
- M: `06-content-creator/SKILL.md`: 40–66; `knowledge-base/linkedin/templates.md`: 1–86, 389–430; `knowledge-base/linkedin/hooks-library.md`: 28–84.
- `evals/data/listings.json` and `labels.json`: the ten spot-check rows; listing image entries for the CSP comparison.

## Runtime evidence reads, not exhaustive manual review

- Current `agent.py`, `main.py`, `test_agent.py`, synthetic `tests/search_page.html`, Convex `.ts`/`.js` modules/tests/generated bindings, and `frontend/src/lib/history.js`, `dates.js` plus tests were copied into isolated test directories and executed.
- Old `agent.py` and `main.py` from `git show 1749eab` were read to test both compatibility directions.
- `evals/data/scorer_results.json`, `chat_results.json`, `labels.json` were read by an AST-only report reproduction; no provider/model call was made.
- Existing installed Python/Node dependency modules were used. Python dotenv loaders were disabled before app imports; parser/report AST tests did not import the app.
- Newly generated round-two reproduction scripts and their raw logs were inspected after execution; exact names and commands are in `evidence-2026-09-27/round2-implementation/commands-results.json` and that directory's `findings.md`.

## External observations

- All ten listing URLs from `evals/data/spotcheck.md`; browser follow-up on rows 4, 6, 8, 9, 10. No seller contact.
- Live signed-out landing and `/api/health`, response headers; local Mac network, not a human mobile test.
- GitHub CI/uptime metadata for cac3821. No production deployment metadata or authenticated product flow inspected.
- Isolated local browser fixture compared report-only and enforced CSP against two existing public listing images.
- Linear project lookup failed with reauthentication required; no tracker changes.

## Workflow instructions

`~/.codex/plugins/cache/openai-curated-remote/superpowers/6.4.2/skills/using-superpowers/SKILL.md`, `dispatching-parallel-agents/SKILL.md`; `~/.agents/skills/evidence-and-verification/SKILL.md`; `~/.codex/skills/auditable-linear-issue-management/SKILL.md`.

No `.env` file, credential store, private inbox, production log dashboard, course PDF or recording was opened this round. No claim is made that the entire course/marketing pack was reread: relevant primary files above extend the earlier audit's documented reads.
