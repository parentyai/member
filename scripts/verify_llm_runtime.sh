#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${ADMIN_BASE_URL:-http://127.0.0.1:${PORT:-8080}}"
TRACE_ID="${TRACE_ID:-llm_runtime_verify_$(date +%s)}"
ACTOR="${ADMIN_ACTOR:-llm_runtime_verifier}"
ADMIN_TOKEN="${ADMIN_OS_TOKEN:-}"
STATUS_JSON_OVERRIDE="${LLM_RUNTIME_STATUS_JSON:-}"

if [[ -n "${STATUS_JSON_OVERRIDE}" ]]; then
  RAW_RESPONSE="${STATUS_JSON_OVERRIDE}"
else
  if [[ -z "${ADMIN_TOKEN}" ]]; then
    echo "ADMIN_OS_TOKEN is required" >&2
    exit 2
  fi
  STATUS_URL="${BASE_URL%/}/api/admin/llm/config/status"
  RAW_RESPONSE="$(curl -fsS "${STATUS_URL}" \
    -H "x-admin-token: ${ADMIN_TOKEN}" \
    -H "x-actor: ${ACTOR}" \
    -H "x-trace-id: ${TRACE_ID}")"
fi

printf '%s' "${RAW_RESPONSE}" | node -e '
const fs = require("node:fs");
const raw = fs.readFileSync(0, "utf8");
let json;
try {
  json = JSON.parse(raw || "{}");
} catch (err) {
  console.error("invalid_json_response");
  process.exit(1);
}
const runtime = json && typeof json.runtimeState === "object" ? json.runtimeState : {};
const envFlag = runtime.envFlag !== undefined ? runtime.envFlag : json.envFlag;
const systemFlag = runtime.systemFlag !== undefined ? runtime.systemFlag : json.systemFlag;
const effectiveEnabled = runtime.effectiveEnabled !== undefined ? runtime.effectiveEnabled : json.effectiveEnabled;
const blockingReason = runtime.blockingReason !== undefined ? runtime.blockingReason : json.blockingReason;

const failures = [];
if (envFlag !== true) failures.push("env_flag_disabled");
if (systemFlag !== true) failures.push("system_flag_disabled");
if (effectiveEnabled !== true) failures.push("effective_disabled");
if (blockingReason !== null && blockingReason !== undefined && String(blockingReason).trim() !== "") {
  failures.push("blocking_reason_present");
}

if (failures.length > 0) {
  console.error(JSON.stringify({
    ok: false,
    reason: "runtime_guard_failed",
    failedChecks: failures,
    envFlag,
    systemFlag,
    effectiveEnabled,
    blockingReason: blockingReason || null
  }));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  envFlag: true,
  systemFlag: true,
  effectiveEnabled: true,
  blockingReason: null
}, null, 2));
'
