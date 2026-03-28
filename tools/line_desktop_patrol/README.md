# LINE Desktop Patrol

Local-only LINE patrol harness for Codex. The current execution path is MCP over stdio with two guarded paths:
- `send_text`: existing LINE Messaging API push path
- `desktop_snapshot` / `desktop_run_conversation_loop`: macOS LINE Desktop UI control via Accessibility + OCR evidence

## Current scope
- policy schema and example config
- trace / proposal schema
- Python MCP sidecar package
- read-only repo runtime state bridge
- guarded `send_text` execution bridge via existing `lineClient.pushMessage`
- guarded desktop UI bridge for user-account send / observe / improve loops

## Safe defaults
- `enabled=false`
- `dry_run_default=true`
- `auto_apply_level=none`
- whitelist targets only
- sample targets remain `dry_run` only
- proposal queue stays append-only

## Local prerequisites for execute mode
- local policy override file with `enabled=true`
- target whitelist entry whose `allowed_send_modes` includes `execute`
- for `desktop_run_conversation_loop`:
  - macOS Accessibility permission is trusted for Codex
  - the target `expected_chat_title` contains `メンバー`
  - LINE Desktop is running and the target chat is reachable from the sidebar
- for `send_text`:
  - `LINE_CHANNEL_ACCESS_TOKEN`
  - `LINE_DESKTOP_PATROL_TARGET_<ALIAS>_LINE_USER_ID`
- global kill switch must be OFF
- optional local env bootstrap file: `tools/line_desktop_patrol/config/patrol.local.env`

## Commands
- `npm run line-desktop-patrol:validate`
- `npm run line-desktop-patrol:state`
- `npm run line-desktop-patrol:targets`
- `npm run line-desktop-patrol:desktop-readiness -- --target-alias sample-self-test`
- `npm run line-desktop-patrol:desktop-self-test -- --target-alias sample-self-test --text '...' --send-mode dry_run`
- `npm run line-desktop-patrol:desktop-self-improvement -- --target-alias sample-self-test --send-mode execute`
- `npm run line-desktop-patrol:tool -- desktop-loop --target-alias sample-self-test --text '...' --send-mode dry_run`
- `npm run line-desktop-patrol:doctor`
- `npm run line-desktop-patrol:open-target`
- `npm run line-desktop-patrol:execute-once`
- `npm run line-desktop-patrol:loop-execute`
- `npm run line-desktop-patrol:acceptance-gate`
- `python3 -m compileall tools/line_desktop_patrol/src`
- `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.mcp_server --manifest`
- `tools/line_desktop_patrol/run_mcp_server.sh`

## Safe execute sequence
1. `npm run line-desktop-patrol:doctor`
2. `npm run line-desktop-patrol:open-target`
3. `npm run line-desktop-patrol:execute-once`
4. `npm run line-desktop-patrol:loop-execute`
5. `npm run line-desktop-patrol:acceptance-gate`

If `open-target` returns `open_target_mismatch_stop`, stop before send and correct the pinned `メンバー` title match first.
Treat `generic LINE shell only` as a fail-closed preflight state: the LINE shell is frontmost, but the member-only chat is not yet resolved.

## Debug commands
- `line-desktop-patrol:send` is debug-only and stays outside the formal safe execute sequence.

## Layout
- `config/`
- `scenarios/`
- `src/member_line_patrol/`

## Notes
- `send_text` is API-backed and local-only.
- `desktop_readiness` is read-only and reports whether Codex can safely control LINE Desktop before attempting a loop.
- `desktop-self-test` runs `desktop_readiness` first and only then executes `desktop_run_conversation_loop` in the same local MCP session.
- `desktop_run_conversation_loop` sends from the signed-in desktop LINE account, waits for a reply, captures transcript evidence, and enqueues a local proposal when the loop fails.
- `desktop-self-improvement` runs one readiness gate and then a fixed strategic batch of 10 sends. Each case has an explicit strategic goal, a human-natural reply contract, a patrol eval artifact, and an aggregated proposal summary for the future auto-improvement loop.
- before the first send, `desktop-self-improvement` preflights the remaining hourly execute budget. If the current local patrol budget cannot absorb all 10 sends, it fails before sending anything and reports the exact shortfall instead of half-running the batch.
- when a blocking local patrol error appears mid-batch, later cases are marked as blocked with the same code so the summary preserves why the strategic loop stopped.
- execute mode still respects blocked hours, local rate limits, failure streak stop, target confirmation, and the existing global kill switch.
- the quicker local MCP path is `desktop-self-test`, but the formal operator bundle still uses `doctor -> open-target -> execute-once -> loop-execute -> acceptance-gate`.
