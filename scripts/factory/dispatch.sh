#!/usr/bin/env bash
# Claim one ready issue and run its single labeled build engine in an isolated worktree.
set -euo pipefail
[[ $# == 1 && $1 =~ ^[A-Z]+-[0-9]+$ ]] || { echo 'factory: usage: scripts/factory/dispatch.sh <ISSUE>' >&2; exit 1; }
issue=$1
repo=$(git rev-parse --show-toplevel)
cd "$repo"
config="$repo/.factory.json"
engine=$(python3 scripts/factory/lin.py issue "$issue" | python3 -c 'import json,sys; labels=[l["name"] for l in json.load(sys.stdin)["labels"] if l["name"].startswith("engine:")]; sys.exit("factory: expected exactly one engine label") if len(labels)!=1 else print(labels[0])')
effort=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("codex_effort", "xhigh"))' "$config")
case "$engine" in
    engine:gpt-6-sol) model=gpt-6-sol; launcher=codex ;;
    engine:gpt-5.6-sol) model=gpt-5.6-sol; launcher=codex ;;
    engine:codex) model=${FACTORY_CODEX_BUILD_MODEL:?factory: set FACTORY_CODEX_BUILD_MODEL for engine:codex}; launcher=codex ;;
    engine:claude-opus-4.8|engine:claude-sonnet-5|engine:claude-haiku-4.5|engine:claude-fable-5|engine:claude-opus-5) model=${engine#engine:}; launcher=claude ;;
    engine:claude) model=${FACTORY_CLAUDE_BUILD_MODEL:?factory: set FACTORY_CLAUDE_BUILD_MODEL for engine:claude}; launcher=claude ;;
    *) echo "factory: unsupported engine label $engine" >&2; exit 1 ;;
esac
if [[ $launcher == codex ]]; then
    [[ -x /opt/homebrew/bin/codex ]] || { echo 'factory: /opt/homebrew/bin/codex is unavailable' >&2; exit 1; }
else
    command -v claude >/dev/null || { echo 'factory: claude is unavailable' >&2; exit 1; }
fi
git fetch origin main
worktree="$repo/.factory-worktrees/$issue"
branch="factory/$issue"
if git worktree list --porcelain | grep -Fqx "worktree $worktree"; then
    [[ $(git -C "$worktree" branch --show-current) == "$branch" ]] || { echo "factory: $worktree is on the wrong branch" >&2; exit 1; }
elif [[ -e $worktree ]]; then
    echo "factory: unregistered worktree path exists: $worktree" >&2; exit 1
elif git show-ref --verify --quiet "refs/heads/$branch"; then
    git worktree add "$worktree" "$branch"
else
    git worktree add -b "$branch" "$worktree" origin/main
fi
brief=$(mktemp)
trap 'rm -f "$brief"' EXIT
{
    echo "You are the BUILDER for Linear issue $issue in branch $branch. Implement exactly the spec and addenda below."
    echo 'Read repo AGENTS.md. Do not commit; the station commits. Run the narrowest useful checks.'
    echo 'Use plain, calm English for user messages. Do not edit the main checkout environment files.'
    echo "Engine: $engine ($model). Context: $launcher foreground build. Commit owner: station."
    echo '=== SPEC ==='
    python3 scripts/factory/lin.py spec "$issue"
} > "$brief"
claim=$(python3 scripts/factory/lin.py claim "$issue")
version=$([[ $launcher == codex ]] && /opt/homebrew/bin/codex --version || claude --version)
printf 'engine routed: %s model=%s context=%s foreground commit-owner=station binary-version=%s effort=%s claim=%s base=%s\n' "$engine" "$model" "$launcher" "$version" "$effort" "$claim" "$(git -C "$worktree" rev-parse HEAD)" | python3 scripts/factory/lin.py comment "$issue" >/dev/null
cd "$worktree"
if [[ $launcher == codex ]]; then
    /opt/homebrew/bin/codex exec --sandbox workspace-write --skip-git-repo-check -m "$model" -c "model_reasoning_effort=$effort" -c sandbox_workspace_write.network_access=true "$(cat "$brief")" </dev/null
else
    claude -p --model "$model" "$(cat "$brief")" </dev/null
fi
