#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   export BASE_URL="https://member-xxxxx-ue.a.run.app"
#   export NOTIFICATION_ID="<notificationId>"
#   export LINE_USER_ID="<lineUserId>"
#   bash scripts/phase16_test_send.sh

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

REQUEST_ID="${REQUEST_ID:-$(node -e "console.log(require('crypto').randomUUID())")}"
echo "requestId=${REQUEST_ID}"
TOKEN="$(gcloud auth print-identity-token)"
if [[ -z "$TOKEN" ]]; then
  echo "Failed to get identity token" >&2
  exit 1
fi

ENDPOINT="${BASE_URL}/admin/notifications/${NOTIFICATION_ID}/test-send"

BODY=$(cat <<JSON
{"lineUserId":"${LINE_USER_ID}","text":"phase16 test send"}
JSON
)

curl -i \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "content-type: application/json; charset=utf-8" \
  -H "x-request-id: ${REQUEST_ID}" \
  --data "${BODY}" \
  "${ENDPOINT}"
