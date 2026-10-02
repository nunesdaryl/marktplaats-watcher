#!/usr/bin/env bash
# The only factory merge entry point for this repo.
set -euo pipefail
fail() { echo "factory: $*" >&2; exit 1; }
[[ $# == 2 ]] || fail "usage: scripts/factory-merge.sh <ISSUE> <REVIEWED_SHA>"
issue=$1
reviewed_sha=$2
[[ $issue =~ ^[A-Z]+-[0-9]+$ ]] || fail "invalid issue identifier: $issue"
[[ $reviewed_sha =~ ^[0-9a-f]{40}$ ]] || fail "reviewed SHA must be 40 lowercase hex characters"
repo=$(git rev-parse --show-toplevel)
cd "$repo"
[[ $(git branch --show-current) == main ]] || fail "run from the main checkout on main"
[[ -z $(git status --porcelain) ]] || fail "main checkout is dirty"
[[ $(git rev-parse "refs/heads/factory/$issue" 2>/dev/null || true) == "$reviewed_sha" ]] || fail "factory/$issue tip differs from reviewed SHA"
approval=$(python3 scripts/factory/lin.py ready "$issue" "$reviewed_sha" | python3 -c 'import json,sys; print(json.load(sys.stdin)["approver"])') || fail "$issue is missing merge readiness or Linear is unavailable"
[[ $approval != *'|'* && $approval != *'`'* ]] || fail "approval text cannot be written safely to the merge log"
[[ $(git rev-parse main) == $(git rev-parse origin/main) ]] || fail "main is not at origin/main"
[[ $(git rev-parse wave1-demo-ready) == $(git rev-parse origin/wave1-demo-ready) ]] || fail "wave1-demo-ready is not at origin"
git checkout wave1-demo-ready
before=$(git rev-parse HEAD)
git merge --no-ff "factory/$issue" -m "Merge $issue: reviewed $reviewed_sha via factory gate"
merge_sha=$(git rev-parse HEAD)
python=.venv/bin/python
[[ -x $python ]] || fail "missing .venv/bin/python in main checkout"
"$python" -m pytest -q
(
    cd frontend
    npx vitest run --configLoader runner
    npm run typecheck
    npm run build
)
[[ -z $(git status --porcelain) ]] || fail "checks changed the checkout; inspect before proceeding"
if git diff --name-only "$before" "$merge_sha" -- frontend/convex | grep -q .; then
    (cd frontend && npx convex deploy -y)
    [[ -z $(git status --porcelain) ]] || fail "Convex deploy changed tracked or untracked files; inspect before proceeding"
    convex=deployed
else
    convex=unchanged
fi
git push origin wave1-demo-ready
git checkout main
git merge --ff-only wave1-demo-ready
git push origin main
wait_production() {
    local sha=$1 deployment state
    for (( attempt=0; attempt<40; attempt++ )); do
        deployment=$(gh api "repos/{owner}/{repo}/deployments?sha=$sha&environment=Production" --jq '.[0].id // empty') || fail "cannot query Vercel Production deployment"
        if [[ -n $deployment ]]; then
            state=$(gh api "repos/{owner}/{repo}/deployments/$deployment/statuses" --jq '.[0].state // empty') || fail "cannot query deployment status"
            [[ $state == success ]] && return 0
            [[ $state == failure || $state == error ]] && fail "Vercel Production deployment $deployment: $state"
        fi
        sleep 15
    done
    fail "Vercel Production did not report success for $sha"
}
wait_production "$merge_sha"
for page in / /chat/ /watches/ /alerts/ /rate/; do
    code=$(curl --fail-with-body -sS -o /dev/null -w '%{http_code}' "https://marktplaats-watcher.vercel.app$page") || fail "smoke failed for $page"
    [[ $code == 200 ]] || fail "smoke $page returned $code"
done
code=$(curl -sS -o /dev/null -w '%{http_code}' -X POST 'https://marktplaats-watcher.vercel.app/api/chat' -H 'content-type: application/json' -d '{"message":"hi"}') || fail "chat smoke request failed"
[[ $code == 401 ]] || fail "chat without login returned $code instead of 401"
if git diff --name-only "$before" "$merge_sha" -- agent.py evals | grep -q .; then
    gh workflow run evals.yml --ref main
    evals=triggered
else
    evals=unchanged
fi
checks="pytest, vitest, typecheck, build, Convex:$convex, Vercel Production:$merge_sha, smoke:passed, evals:$evals"
log=docs/factory/merges.md
printf '| %s | %s | `%s` | `%s` | %s | %s |\n' "$(date -u +%Y-%m-%d)" "$issue" "$reviewed_sha" "$merge_sha" "$approval" "$checks" >> "$log"
git add "$log"
git commit -m "Record factory merge $issue"
git push origin main
git checkout wave1-demo-ready
git merge --ff-only main
git push origin wave1-demo-ready
git checkout main
wait_production "$(git rev-parse HEAD)"
python3 scripts/factory/lin.py finish "$issue" "$reviewed_sha" "$merge_sha" "$approval" "$checks"
worktree="$repo/.factory-worktrees/$issue"
if git worktree list --porcelain | grep -Fqx "worktree $worktree"; then
    git worktree remove --force "$worktree"
fi
git branch -d "factory/$issue"
if git ls-remote --exit-code --heads origin "factory/$issue" >/dev/null 2>&1; then
    git push origin --delete "factory/$issue"
fi
echo "factory: $issue merged as $merge_sha and recorded in $log"
