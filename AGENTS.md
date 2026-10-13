# Factory operations

The main checkout's `.env` and `frontend/.env.local` are off limits. Never create, move, overwrite, or symlink them. Production data writes need the operator's OK.

The factory evidence profile is pytest, vitest, typecheck, build, Convex deployment when functions change, Vercel Production verification, and live page and unauthenticated chat smoke checks. UI issues also require a preview walk and screenshots in review evidence.

The eval workflow runs automatically on pushes and pull requests that touch its configured paths, and weekly on Monday. Agents and the station may start a manual `workflow_dispatch` only when no automatic run covers the exact SHA under review, the operator asks, or a run failed for infrastructure reasons; retry an infrastructure failure only once. Never re-run just to get a better sample, and name each manual dispatch and its reason in the review evidence.

Run one Linear `agent-ready` issue with `scripts/factory/dispatch.sh MW-<number>`. Review the committed branch tip, record the PASS verdict and `ready-to-merge` label, and obtain a per-issue `Operator merge approval:` comment after that verdict. Then run `scripts/factory-merge.sh MW-<number> <reviewed-40-character-SHA>` from the clean main checkout. The gate rechecks Linear and runs the release evidence. It writes `docs/factory/merges.md` and closes the issue only after production checks succeed. Do not use a plain merge for factory work.
