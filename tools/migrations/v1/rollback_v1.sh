#!/usr/bin/env bash
set -euo pipefail

echo "[rollback-v1] setting V1 feature flags to false"
cat <<'OUT'
Set the following env vars to rollback values before restart:
- ENABLE_V1_CHANNEL_EDGE=false
- ENABLE_V1_FAST_SLOW_DISPATCH=false
- ENABLE_V1_LIFF_SYNTHETIC_EVENTS=false
- ENABLE_V1_OPENAI_RESPONSES=false
- ENABLE_V1_SEMANTIC_OBJECT_STRICT=false
- ENABLE_V1_MEMORY_FABRIC=false
- ENABLE_V1_ACTION_GATEWAY=false
- ENABLE_V1_LINE_RENDERER=false
- ENABLE_V1_EVIDENCE_LEDGER=false
- ENABLE_V1_REPLAY_GATES=false
OUT
