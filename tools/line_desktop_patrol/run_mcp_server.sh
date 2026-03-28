#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ -n "${LINE_DESKTOP_PATROL_ENV_FILE:-}" && -r "${LINE_DESKTOP_PATROL_ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${LINE_DESKTOP_PATROL_ENV_FILE}"
elif [[ -r "${SCRIPT_DIR}/config/patrol.local.env" ]]; then
  # shellcheck disable=SC1091
  source "${SCRIPT_DIR}/config/patrol.local.env"
fi

if [[ -z "${LINE_DESKTOP_PATROL_POLICY_PATH:-}" && -r "${SCRIPT_DIR}/config/policy.local.json" ]]; then
  export LINE_DESKTOP_PATROL_POLICY_PATH="${SCRIPT_DIR}/config/policy.local.json"
fi

if [[ "$#" -eq 0 ]]; then
  exec python3 "${SCRIPT_DIR}/src/member_line_patrol/mcp_server.py" --serve
fi

exec python3 "${SCRIPT_DIR}/src/member_line_patrol/mcp_server.py" "$@"
