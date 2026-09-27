# Files actually read before drafting the audit

27 September 2026. Audited source commit: `1749eab24d65cb3d4b5d3409b77c6aee3df3d0fd`.

This manifest combines the primary auditor's reads with three independent reviewers (implementation, course, marketing). “Read” means content inspected, not merely found in a directory. Partial reads are identified. No `.env` variants or key-bearing files were opened. No production write, model call, real email, or social post was made. All application tests ran in an isolated copy with environment-file loading disabled; Python outbound sockets were blocked. The initial working tree contained only pre-existing untracked `docs/audit/`.

## Path roots

- **P**: `/Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher`
- **F**: `/Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill`
- **M**: `/Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack`
- **V**: `/Users/daryldimitrianthony/FDE Course/FDE Vault`
- **C**: `/Users/daryldimitrianthony/FDE Course/1 Course Material`

## Project: full files, unless otherwise indicated

```text
P/docs/audit/chatgpt-deep-audit-brief.md
P/README.md
P/docs/system-design.html — all §13; historical excerpts 130–350 and 480–608, not entire HTML
P/evals/report.md
P/RUNBOOK.md
P/DEPLOY-VERCEL.md
P/Dockerfile
P/docs/demo/problem-statement.md
P/docs/demo/demo-script.md
P/docs/demo/pre-demo-checklist.md
P/docs/marketing/index.md
P/docs/marketing/references/onboarding.md
P/docs/marketing/references/research.md
P/docs/marketing/references/testimonials.md
P/docs/marketing/references/brand-voice.md
P/docs/marketing/generated/buyer-avatar.md
P/docs/marketing/generated/in-app-copy.md
P/docs/marketing/generated/linkedin-audience.md
P/docs/marketing/generated/linkedin-launch-post.md
P/docs/marketing/generated/linkedin-series.md
P/docs/marketing/generated/validation.md
P/docs/marketing/generated/x-repurpose.md
P/docs/marketing/competitors/marktalert.md
P/docs/marketing/competitors/mpalerts.md
P/docs/marketing/competitors/marktplaats-saved-search.md
P/agent.py
P/main.py
P/test_agent.py
P/evals/chat_cases.py
P/evals/data/spotcheck.md
P/.github/workflows/ci.yml
P/.github/workflows/uptime.yml
P/frontend/AGENTS.md
P/frontend/CLAUDE.md
P/frontend/package.json
P/frontend/vitest.config.ts
P/frontend/convex/checker.ts
P/frontend/convex/watches.ts
P/frontend/convex/users.ts
P/frontend/convex/schema.ts
P/frontend/convex/crons.ts
P/frontend/convex/feedback.ts
P/frontend/convex/schedule.ts
P/frontend/convex/chats.ts
P/frontend/convex/health.ts
P/frontend/convex/watches.test.ts
P/frontend/convex/manage.test.ts
P/frontend/convex/health.test.ts
P/frontend/convex/chats.test.ts
P/frontend/convex/feedback.test.ts
P/frontend/convex/email.test.ts
P/frontend/convex/schedule.test.ts
P/frontend/src/views/PrivacySheet.jsx
P/frontend/src/views/ChatView.jsx
P/frontend/src/Landing.jsx
P/frontend/src/lib/history.js
P/frontend/src/lib/history.test.js
P/frontend/src/lib/dates.js
P/frontend/src/lib/dates.test.js
P/frontend/src/App.jsx — lines 1–180 only
P/frontend/app/layout.jsx — metadata and layout excerpts
P/tests/search_page.html — synthetic fixture consumed by offline tests, not manually reviewed in full
```

Some early bulk marketing reads were truncated. The dedicated marketing reviewer subsequently read all listed marketing documents; they are not classified as complete merely because a bulk command included them. Generated Convex files were consumed by tests, not independently reviewed. The remaining frontend components, styles, deployment settings, all git history, and live authenticated flows were not exhaustively audited.

## FDE course skill: complete

```text
F/SKILL.md
F/references/checklists.md
F/references/agent-engineering.md
F/references/software-engineering-foundation.md
F/references/second-brain-and-startup.md
```

## Vault: complete selected notes

```text
V/Home.md
V/Projects/Marktplaats Watcher.md
V/Agent Engineering Cheat Sheet.md
V/Evaluation Results.md
V/Decisions.md
V/MVP Gaps.md
V/Concepts/Graph Engineering.md
V/Concepts/MCP.md
V/Concepts/Sandboxing.md
V/Concepts/Permissions.md
V/Concepts/Skills.md
V/Concepts/Evaluation Engineering.md
```

Scoped existence checks found no `V/raw/`, `V/wiki/`, or `V/CLAUDE.md`, and no project-root `AGENTS.md`, `CLAUDE.md`, or `.claude/skills/`. `V/Components/Env Secrets.md` was explicitly excluded. No claim is made to have read the whole vault.

## Original course material

| Actual file | Reading scope |
|---|---|
| C/Day 1/Day 1 cheat sheet.pdf | All 2 pages, extracted text |
| C/Day 1/Day 1 full deck (197 pages).pdf | All pages extracted and title-indexed; read pages 18–20, 52–55, 98–100, 109, 123–124, 139–142, 146–147, 150, 153, 157–158, 161–162, 164, 166–167, 170–175, 177, 179–180; visually checked p139 |
| C/Day 1/Day 1 full deck (duplicate copy).pdf | Metadata/hash comparison only; identical hash, not reread |
| C/Day 1/Day 1 slides (82 pages).pdf | Extracted and title-indexed; not fully read |
| C/Day 2/Day 2 agent engineering cheat sheet.png | Complete image inspected |
| C/Day 2/Day 2 handwritten notes (scan).pdf | Entire single tall page visually read in seven consecutive crops; extraction yielded no text |
| C/Day 3/Day 3 second brain and software factory.pdf | Extracted/title-indexed; read overview and pages 5–7, 10, 13, 20–21; visually checked p20 |
| C/Day 3/Day 3 startup cycle.pdf | Extracted/title-indexed; read overview and pages 17, 19–20, 22–23, 25–26, 29, 33, 35, 41, 43, 58, 63; visually checked p25 |

Recordings, PPTX and ZIP duplicates were not reviewed. This audit covers the applicable principles, not every slide or recording.

## Marketing skill pack

Full instruction files:

```text
M/01-commander/CLAUDE.md
M/02-onboarding/CLAUDE.md
M/03-strategist/CLAUDE.md
M/04-researcher/CLAUDE.md
M/05-copywriter/CLAUDE.md
M/06-content-creator/CLAUDE.md
M/07-ads-specialist/CLAUDE.md
M/08-customer-service/CLAUDE.md
M/09-seo-specialist/CLAUDE.md
M/10-product-builder/CLAUDE.md
M/_vault/index.md
M/01-commander/SKILL.md
M/06-content-creator/SKILL.md
M/10-product-builder/SKILL.md
M/03-strategist/knowledge-base/index.md
M/05-copywriter/references/long-form-frameworks/proof.md
M/06-content-creator/knowledge-base/linkedin/writing-rules.md
M/06-content-creator/knowledge-base/platform-guides/linkedin.md
M/06-content-creator/references/linkedin-voorbeelden/README.md
M/08-customer-service/knowledge/escalation-rules.md
M/10-product-builder/knowledge-base/product-validatie.md
```

Targeted excerpts:

```text
M/02-onboarding/SKILL.md — 1–45
M/03-strategist/SKILL.md — 1–177
M/04-researcher/SKILL.md — 198–274
M/03-strategist/knowledge-base/frameworks.md — sections 1–2 and 24
M/06-content-creator/knowledge-base/linkedin/templates.md — overview/selection and templates 6,21
M/06-content-creator/knowledge-base/linkedin/hooks-library.md — categories 1–4
M/06-content-creator/knowledge-base/content-frameworks.md — 1–90
```

## Audit method and test safety files

```text
/Users/daryldimitrianthony/.codex/plugins/cache/openai-curated-remote/superpowers/6.4.2/skills/using-superpowers/SKILL.md
/Users/daryldimitrianthony/.codex/plugins/cache/openai-curated-remote/superpowers/6.4.2/skills/dispatching-parallel-agents/SKILL.md
/Users/daryldimitrianthony/.agents/skills/evidence-and-verification/SKILL.md
/Users/daryldimitrianthony/.codex/skills/auditable-linear-issue-management/SKILL.md
/Users/daryldimitrianthony/.codex/skills/typesafe-ai/SKILL.md
P/.venv/lib/python3.12/site-packages/dotenv/__init__.py — loader behavior only, never an environment file
```

Read raw synthetic-test commands/results from temporary `mp-watcher-audit-e1aw1ti7`: `commands.txt`, `js-baseline.log`, `python-baseline.log`, `lifecycle-repro.log`, `parser-repro.log`. Reviewer-created reproduction source and safety runner are preserved separately with the audit evidence.

## Live checks and primary web sources

The public landing page was read in the Codex browser. No signed-in flow was exercised. GitHub run metadata for current commit was read with `gh run list` and `gh run view 36326146184`. Linear search/project lookup both returned reauthentication-required; no duplicate check or tracker mutation succeeded.

Primary sources read through web tools (targeted passages; not whole sites):

- [Marktplaats terms, articles 7.1–7.3](https://www.marktplaats.nl/i/help/over-marktplaats/voorwaarden-en-privacybeleid/algemene_voorwaarden_marktplaats_7.pdf)
- [Dutch cancellation period](https://business.gov.nl/regulations/cancellation-period-sale/)
- [Online cancellation button](https://business.gov.nl/amendments/online-shops-must-have-cancellation-button/)
- [KVK registration](https://business.gov.nl/regulations/register-your-business-in-the-business-register/)
- [VAT](https://business.gov.nl/regulations/vat/)
- [AP processor agreements](https://autoriteitpersoonsgegevens.nl/themas/basis-avg/avg-algemeen/verwerkersovereenkomst)
- [AP privacy notice template](https://autoriteitpersoonsgegevens.nl/documenten/sjabloon-privacyverklaring-mkb)
- [Vercel Hobby commercial-use restriction](https://vercel.com/docs/plans/hobby)
- [Vercel plan overview](https://vercel.com/docs/plans)
- [OpenAI project controls](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform)
- [OpenAI spend-limit enforcement](https://developers.openai.com/api/docs/guides/spend-limits)
- [TypeSafe index](https://docs.typesafe.ai/llms.txt), [Score](https://docs.typesafe.ai/primitives/score), [Noul](https://docs.typesafe.ai/primitives/noul)

Web facts are captured in `2026-09-27-evidence.md` with the sources, rather than represented as local project implementation facts.
