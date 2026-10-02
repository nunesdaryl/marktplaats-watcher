#!/usr/bin/env bash
# Show the read-only inputs and queues for the Monday listening routine.
set -euo pipefail
cd "$(dirname "$0")/../.."
exec python3 scripts/factory/loop_status.py
