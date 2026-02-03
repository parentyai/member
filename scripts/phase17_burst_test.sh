#!/usr/bin/env bash
set -uo pipefail

# Usage:
#   export BASE_URL="https://member-xxxxx-ue.a.run.app"
#   export NOTIFICATION_ID="<notificationId>"
#   export LINE_USER_ID="<lineUserId>"
#   export COUNT=20
#   bash scripts/phase17_burst_test.sh

if [[ -z "${BASE_URL:-}" ]]; then
  echo "BASE_URL is required" >&2
  exit 1
fi
if [[ -z "${NOTIFICATION_ID:-}" ]]; then
  echo "NOTIFICATION_ID is required" >&2
  exit 1
fi
if [[ -z "${LINE_USER_ID:-}" ]]; then
  echo "LINE_USER_ID is required" >&2
  exit 1
fi

COUNT=${COUNT:-20}

ok=0
fail=0

for i in $(seq 1 "$COUNT"); do
  REQUEST_ID="$(node -e "console.log(require('crypto').randomUUID())")"
  echo "run=${i} requestId=${REQUEST_ID}"
  if REQUEST_ID="$REQUEST_ID" bash scripts/phase16_test_send.sh; then
    ok=$((ok+1))
  else
    fail=$((fail+1))
  fi
  echo "---"
done

echo "summary ok=${ok} fail=${fail}"
