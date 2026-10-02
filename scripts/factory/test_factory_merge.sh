#!/usr/bin/env bash
set -euo pipefail
source_root=$(cd "$(dirname "$0")/../.." && pwd)
repo=$(mktemp -d)
trap 'rm -rf "$repo"' EXIT
cd "$repo"
git init -q -b main
git config user.email test@example.com
git config user.name Test
git config core.autocrlf false
mkdir -p scripts/factory
cp "$source_root/scripts/factory-merge.sh" scripts/factory-merge.sh
cat > scripts/factory/lin.py <<'PY'
import os
import sys
if sys.argv[1] == "ready":
    reason = os.environ.get("MOCK_REFUSAL")
    if reason:
        raise SystemExit("factory: MW-999 " + reason)
    print('{"approver":"Daryl, in chat, 2 Oct 2026"}')
PY
printf 'base\n' > file.txt
git add .
git commit -qm base
git branch factory/MW-999
sha=$(git rev-parse factory/MW-999)
refuse() {
    local name=$1 expected=$2
    shift 2
    if output=$("$@" 2>&1); then
        echo "FAIL $name: merge gate accepted invalid input" >&2
        exit 1
    fi
    if [[ "$output" != *"$expected"* ]]; then
        echo "FAIL $name: $output" >&2
        exit 1
    fi
    echo "PASS $name"
}
refuse wrong-sha 'reviewed SHA' bash scripts/factory-merge.sh MW-999 0000000000000000000000000000000000000000
refuse missing-label 'ready-to-merge' env MOCK_REFUSAL='requires ready-to-merge' bash scripts/factory-merge.sh MW-999 "$sha"
refuse no-approval 'Operator merge approval' env MOCK_REFUSAL='needs Operator merge approval' bash scripts/factory-merge.sh MW-999 "$sha"
refuse old-approval 'after the PASS verdict' env MOCK_REFUSAL='needs Operator merge approval after the PASS verdict' bash scripts/factory-merge.sh MW-999 "$sha"
printf 'dirty\n' >> file.txt
refuse dirty-tree 'main checkout is dirty' bash scripts/factory-merge.sh MW-999 "$sha"
