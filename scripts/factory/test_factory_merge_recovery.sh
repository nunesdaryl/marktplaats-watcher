#!/usr/bin/env bash
set -euo pipefail
source_root=$(cd "$(dirname "$0")/../.." && pwd)
test_root=$(mktemp -d)
trap 'rm -rf "$test_root"' EXIT
real_git=$(command -v git)

setup_repo() {
    local name=$1
    local changed_file=${2:-requirements.txt}
    repo="$test_root/$name"
    "$real_git" init -q --bare "$repo.remote"
    "$real_git" init -q -b main "$repo"
    cd "$repo"
    git config user.email test@example.com
    git config user.name Test
    git config core.autocrlf false
    git remote add origin "$repo.remote"
    mkdir -p scripts/factory frontend/convex/_generated docs/factory .venv/bin mockbin
    cp "$source_root/scripts/factory-merge.sh" scripts/factory-merge.sh
    cat > scripts/factory/lin.py <<'PY'
import sys
if sys.argv[1] == "ready":
    print('{"approver":"Test Operator"}')
PY
    printf 'base\n' > requirements.txt
    printf 'base\n' > file.txt
    printf 'base\n' > frontend/convex/_generated/api.d.ts
    printf '| date | issue | reviewed | merge | approver | checks |\n' > docs/factory/merges.md
    cat > .venv/bin/python <<'SH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$TEST_EVENTS"
if [[ $* == '-m pytest -q' && ${FAIL_PYTEST:-} == 1 ]]; then exit 1; fi
SH
    cat > mockbin/gh <<'SH'
#!/usr/bin/env bash
if [[ $1 == api ]]; then
    attempts=$(cat "$TEST_ATTEMPTS")
    printf '%s\n' "$((attempts + 1))" > "$TEST_ATTEMPTS"
    if [[ ${FAIL_GH_ALWAYS:-} == 1 || ( ${FAIL_GH_ONCE:-} == 1 && $attempts == 0 ) ]]; then
        echo 'temporary GitHub API error' >&2
        exit 1
    fi
    if [[ $2 == *statuses ]]; then echo success; else echo 123; fi
fi
SH
    cat > mockbin/curl <<'SH'
#!/usr/bin/env bash
if [[ $* == *'/api/chat'* ]]; then printf 401; else printf 200; fi
SH
    cat > mockbin/sleep <<'SH'
#!/usr/bin/env bash
printf 'sleep %s\n' "$*" >> "$TEST_EVENTS"
SH
    cat > mockbin/git <<'SH'
#!/usr/bin/env bash
if [[ $1 == push && $2 == origin && $3 == --delete ]]; then
    printf 'remote-delete\n' >> "$TEST_EVENTS"
elif [[ $1 == branch && $2 == -D ]]; then
    printf 'local-delete\n' >> "$TEST_EVENTS"
elif [[ $1 == merge-base && ${MOCK_UNMERGED:-} == 1 ]]; then
    exit 1
fi
exec "$REAL_GIT" "$@"
SH
    cat > mockbin/npx <<'SH'
#!/usr/bin/env bash
exit 0
SH
    cat > mockbin/npm <<'SH'
#!/usr/bin/env bash
exit 0
SH
    chmod +x .venv/bin/python mockbin/*
    git add .
    git commit -qm base
    git push -q origin main
    git branch wave1-demo-ready
    git push -q origin wave1-demo-ready
    git checkout -q -b factory/MW-999
    printf 'changed\n' > "$changed_file"
    git add "$changed_file"
    git commit -qm change
    git push -q origin factory/MW-999
    sha=$(git rev-parse HEAD)
    git checkout -q main
    events="$test_root/$name.events"
    attempts_file="$test_root/$name.attempts"
    : > "$events"
    printf '0\n' > "$attempts_file"
}

run_gate() {
    env REAL_GIT="$real_git" TEST_EVENTS="$events" TEST_ATTEMPTS="$attempts_file" \
        PATH="$repo/mockbin:$PATH" "$@" bash scripts/factory-merge.sh MW-999 "$sha"
}

setup_repo success
run_gate FAIL_GH_ONCE=1
[[ $(git branch --show-current) == main ]]
[[ $(git ls-remote --heads origin factory/MW-999) == '' ]]
[[ $(git branch --list factory/MW-999) == '' ]]
[[ $(sed -n '/^remote-delete$/p;/^local-delete$/p' "$events" | paste -sd, -) == 'remote-delete,local-delete' ]]
[[ $(sed -n '1p' "$events") == '-m pip install -q -r requirements.txt' ]]
[[ $(cat "$attempts_file") -ge 5 ]]
echo 'PASS changed requirements installed, API retried, remote deleted before local branch'

setup_repo unchanged_requirements file.txt
run_gate
[[ $(sed -n '1p' "$events") == '-m pytest -q' ]]
echo 'PASS unchanged requirements skip dependency install'

setup_repo pytest_failure
if run_gate FAIL_PYTEST=1; then
    echo 'FAIL pytest failure passed the gate' >&2
    exit 1
fi
[[ $(git branch --show-current) == main ]]
[[ $(git rev-parse wave1-demo-ready) == $(git rev-parse origin/wave1-demo-ready) ]]
echo 'PASS failed checks reset local wave branch and return to main'

setup_repo api_failure
if run_gate FAIL_GH_ALWAYS=1; then
    echo 'FAIL persistent GitHub API failure passed the gate' >&2
    exit 1
fi
[[ $(git branch --show-current) == main ]]
[[ $(git rev-parse wave1-demo-ready) == $(git rev-parse origin/wave1-demo-ready) ]]
[[ $(cat "$attempts_file") -lt 20 ]]
echo 'PASS API retries are bounded and failure restores local wave branch'

setup_repo unmerged
if run_gate MOCK_UNMERGED=1; then
    echo 'FAIL unverified branch was deleted' >&2
    exit 1
fi
[[ -n $(git ls-remote --heads origin factory/MW-999) ]]
[[ -n $(git branch --list factory/MW-999) ]]
[[ $(git branch --show-current) == main ]]
echo 'PASS branch cleanup requires verified main ancestry'
