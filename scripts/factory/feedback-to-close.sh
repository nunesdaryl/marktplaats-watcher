#!/usr/bin/env bash
# Read-only count for the factory review summary.
set -euo pipefail
[[ $# == 1 && $1 =~ ^MW-[0-9]+$ ]] || { echo 'usage: feedback-to-close.sh MW-<number>' >&2; exit 1; }
repo=$(git rev-parse --show-toplevel)
count=$(cd "$repo/frontend" && npx convex run --prod feedback:feedbackToClose "{\"issue\":\"$1\"}")
printf 'Feedback to close: %s\n' "$count"
