#!/usr/bin/env bash
set -euo pipefail

# Phase19-T04 autonomous loop (WIP): test -> verify -> record (no code changes)
# Usage:
#   BASE_URL="https://member-xxxxx-ue.a.run.app" \
#   LINE_USER_ID="Uxxxxxxxx" \
#   LINK_URL="https://example.com" \
#   SA="member-deploy@PROJECT.iam.gserviceaccount.com" \
#   bash scripts/phase19_autonomous_loop.sh

if [[ -z "${BASE_URL:-}" ]]; then
  echo "BASE_URL is required" >&2
  exit 1
fi
if [[ -z "${LINE_USER_ID:-}" ]]; then
  echo "LINE_USER_ID is required" >&2
  exit 1
fi

LINK_URL="${LINK_URL:-https://example.com}"
SA_OPT=()
if [[ -n "${SA:-}" ]]; then
  SA_OPT=(--impersonate-service-account="${SA}")
fi

TOKEN="$(gcloud auth print-identity-token --audiences="${BASE_URL}" "${SA_OPT[@]}")"
if [[ -z "${TOKEN}" ]]; then
  echo "identity token is empty" >&2
  exit 1
fi

request_id() {
  node -e "console.log(require('crypto').randomUUID())"
}

parse_json_field() {
  local field="$1"
  node -e "const fs=require('fs');const data=JSON.parse(fs.readFileSync(0,'utf8'));console.log(data?.${field}||'');"
}

post_json() {
  local url="$1"
  local payload="$2"
  curl -sS -w "\nHTTP_STATUS:%{http_code}\n" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "content-type: application/json; charset=utf-8" \
    --data "${payload}" \
    "${url}"
}

# 1) Link Registry
link_resp="$(post_json "${BASE_URL}/admin/link-registry" "{\"title\":\"phase19 cta link\",\"url\":\"${LINK_URL}\"}")"
link_body="$(printf "%s" "${link_resp}" | sed '/^HTTP_STATUS:/d')"
link_status="$(printf "%s" "${link_resp}" | sed -n 's/^HTTP_STATUS://p' | tail -n 1)"
if [[ "${link_status}" != "200" ]]; then
  echo "link-registry failed: HTTP ${link_status}" >&2
  echo "${link_body}" >&2
  exit 1
fi
link_registry_id="$(printf "%s" "${link_body}" | parse_json_field id)"
if [[ -z "${link_registry_id}" ]]; then
  echo "linkRegistryId missing" >&2
  exit 1
fi

# 2) Notification create (CTA)
notif_resp="$(post_json "${BASE_URL}/admin/notifications" "{\"title\":\"phase19 CTA\",\"body\":\"click: ${LINK_URL}\",\"ctaText\":\"open\",\"linkRegistryId\":\"${link_registry_id}\",\"scenarioKey\":\"A\",\"stepKey\":\"3mo\"}")"
notif_body="$(printf "%s" "${notif_resp}" | sed '/^HTTP_STATUS:/d')"
notif_status="$(printf "%s" "${notif_resp}" | sed -n 's/^HTTP_STATUS://p' | tail -n 1)"
if [[ "${notif_status}" != "200" ]]; then
  echo "notification create failed: HTTP ${notif_status}" >&2
  echo "${notif_body}" >&2
  exit 1
fi
notification_id="$(printf "%s" "${notif_body}" | parse_json_field id)"
if [[ -z "${notification_id}" ]]; then
  echo "notificationId missing" >&2
  exit 1
fi

# 3) test-send
REQUEST_ID="$(request_id)"
test_resp="$(curl -sS -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "content-type: application/json; charset=utf-8" \
  -H "x-request-id: ${REQUEST_ID}" \
  --data "{\"lineUserId\":\"${LINE_USER_ID}\",\"text\":\"phase19 CTA test ${LINK_URL}\"}" \
  "${BASE_URL}/admin/notifications/${notification_id}/test-send")"

test_body="$(printf "%s" "${test_resp}" | sed '/^HTTP_STATUS:/d')"
test_status="$(printf "%s" "${test_resp}" | sed -n 's/^HTTP_STATUS://p' | tail -n 1)"
if [[ "${test_status}" != "200" ]]; then
  echo "test-send failed: HTTP ${test_status}" >&2
  echo "${test_body}" >&2
  exit 1
fi

delivery_id="$(printf "%s" "${test_body}" | parse_json_field deliveryId)"
if [[ -z "${delivery_id}" ]]; then
  delivery_id="$(printf "%s" "${test_body}" | parse_json_field id)"
fi
if [[ -z "${delivery_id}" ]]; then
  echo "deliveryId missing" >&2
  exit 1
fi

# 4) click tracking
CLICK_REQUEST_ID="$(request_id)"
click_resp="$(curl -sS -w "\nHTTP_STATUS:%{http_code}\n" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "content-type: application/json; charset=utf-8" \
  -H "x-request-id: ${CLICK_REQUEST_ID}" \
  --data "{\"deliveryId\":\"${delivery_id}\",\"linkRegistryId\":\"${link_registry_id}\"}" \
  "${BASE_URL}/track/click")"

click_body="$(printf "%s" "${click_resp}" | sed '/^HTTP_STATUS:/d')"
click_status="$(printf "%s" "${click_resp}" | sed -n 's/^HTTP_STATUS://p' | tail -n 1)"
if [[ "${click_status}" != "302" ]]; then
  echo "click failed: HTTP ${click_status}" >&2
  echo "${click_body}" >&2
  exit 1
fi

cat <<OUT
linkRegistryId=${link_registry_id}
notificationId=${notification_id}
deliveryId=${delivery_id}
requestId=${REQUEST_ID}
clickRequestId=${CLICK_REQUEST_ID}
next_logs_filter_test_send='[OBS] action=test-send requestId=${REQUEST_ID}'
next_logs_filter_click='[OBS] action=click deliveryId=${delivery_id} linkRegistryId=${link_registry_id}'
OUT
