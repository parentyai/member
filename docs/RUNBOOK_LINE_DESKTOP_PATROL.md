# RUNBOOK_LINE_DESKTOP_PATROL

Local-only runbook for the LINE patrol MCP harness.

## Preconditions
- test accounts / whitelist targets only
- local policy override path is prepared and pointed to by `LINE_DESKTOP_PATROL_POLICY_PATH`
- or `tools/line_desktop_patrol/config/policy.local.json` exists and is auto-loaded by `run_mcp_server.sh`
- desktop execute targets use `expected_chat_title` that contains `メンバー`
- Codex has macOS Accessibility permission and can activate LINE Desktop
- API-backed execute targets resolve `LINE_DESKTOP_PATROL_TARGET_<ALIAS>_LINE_USER_ID`
- `LINE_CHANNEL_ACCESS_TOKEN` is present only when `send_text` is used
- global kill switch remains the final stop for execute mode

## Validate the harness
1. `npm run line-desktop-patrol:validate`
2. `npm run line-desktop-patrol:state`
3. `npm run line-desktop-patrol:targets`
4. `npm run line-desktop-patrol:desktop-readiness -- --target-alias <alias>`
5. `npm run line-desktop-patrol:desktop-self-test -- --target-alias <alias> --text '...' --send-mode dry_run`
5. `python3 -m compileall tools/line_desktop_patrol/src`
6. `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.mcp_server --manifest`
7. `tools/line_desktop_patrol/run_mcp_server.sh` が起動することを確認

## Execute path
1. set `LINE_DESKTOP_PATROL_POLICY_PATH` to a local override with `enabled=true`
2. keep `require_target_confirmation=true`
3. add `execute` only to the target aliases you explicitly want Codex to use
4. for desktop UI loops, set `expected_chat_title` to the actual LINE group title and keep it scoped to `メンバー`
5. for API-backed sends, export `LINE_DESKTOP_PATROL_TARGET_<ALIAS>_LINE_USER_ID`
6. start the MCP server with `tools/line_desktop_patrol/run_mcp_server.sh`
7. call one of:
   - `desktop_readiness`
   - `desktop_snapshot`
   - `desktop_run_conversation_loop`
   - `desktop-self-test`
   - `send_text`
8. when using `desktop_run_conversation_loop`:
   - `target_alias`
   - `text`
   - `target_confirmation` equal to the alias
   - `send_mode=execute` only when intentional
   - optional `expected_reply_substrings[]` / `forbidden_reply_substrings[]`
9. for the safest operator flow, prefer `desktop-self-test`, which aborts before send when `desktop_readiness.ready` is not true

## Expected outputs
- validate command:
  - confirms schema files exist
  - confirms `policy.example.json` stays disabled and dry-run by default
  - confirms sample targets remain `dry_run` only
- state command:
  - prints repo root
  - prints git sha
  - prints Firestore project id resolution
  - prints kill switch / notification caps / automation mode in read-only form
- execute call:
  - writes `artifacts/line_desktop_patrol/runs/<run_id>/trace.json`
  - writes `artifacts/line_desktop_patrol/runs/<run_id>/result.json`
  - updates `tmp/line_desktop_patrol_latest.json`
  - desktop loops include add-only header OCR evidence and transcript deltas in `result.json`
  - `desktop_readiness` returns `ready`, `accessibilityTrusted`, `lineRunning`, `contextResolved`, and optional title-match evidence
  - `desktop-self-test` returns both `readiness` and `loop` payloads, so operators can confirm the gate that allowed the send

## Stop and rollback
- immediate stop:
  - set the existing global kill switch ON
  - or set `enabled=false` in the local policy override
- local rollback:
  - remove `execute` from target allowlists
  - unset `LINE_DESKTOP_PATROL_TARGET_<ALIAS>_LINE_USER_ID`
- repo rollback:
  - revert the patrol MCP execute-path PR

## Guardrails
- desktop UI control is local-only and limited to targets whose configured title contains `メンバー`
- screenshot retention follows `store_screenshots`; default local policy keeps it off
- no promotion into backlog collections
- no patrol-originated Firestore write path

## Optional operator check
1. Run `npm run line-desktop-patrol:desktop-readiness -- --target-alias <alias>` and confirm `ready=true`.
2. Run `npm run line-desktop-patrol:desktop-self-test -- --target-alias <alias> --text '...' --send-mode dry_run`.
3. Confirm `tmp/line_desktop_patrol_latest.json` points at the latest run and `result.json` contains header OCR evidence for the `メンバー` target.
