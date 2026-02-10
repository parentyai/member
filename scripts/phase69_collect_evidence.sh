#!/usr/bin/env bash
set -euo pipefail

# Phase69 wrapper for evidence collection (delegates to shared implementation).
exec "$(cd "$(dirname "$0")" && pwd)/collect_evidence_common.sh" "$@"
