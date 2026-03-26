# LINE_DESKTOP_PATROL_ARCHITECTURE

macOS 上の LINE Desktop を対象にした閉域 self-evaluation harness の add-only scaffold。

## PR1 Scope
- `tools/line_desktop_patrol/` に Python sidecar の骨組みを隔離する
- `schemas/line_desktop_patrol_*.schema.json` で policy / trace / scenario / proposal 契約を固定する
- `tools/line_desktop_patrol/read_repo_runtime_state.js` で repo-side の global runtime state を read-only 取得する
- no send / no AX / no screenshot のまま safety defaults をコード化する

## Boundaries
- Python sidecar:
  - policy load
  - runtime state model
  - trace store skeleton
  - proposal queue skeleton
  - MCP manifest skeleton
- Node bridge:
  - git sha
  - Firestore project id resolution
  - `system_flags/phase0`
  - phase48 automation config
- Existing runtime:
  - webhook / notification / admin write path is unchanged in PR1

## Safe Defaults
- `enabled=false`
- `dry_run_default=true`
- `auto_apply_level=none`
- `require_target_confirmation=true`
- sample targets are whitelist placeholders only
- proposal queue is append-only and human review remains mandatory

## Filesystem Contract
- schema root:
  - `schemas/line_desktop_patrol_policy.schema.json`
  - `schemas/line_desktop_patrol_trace.schema.json`
  - `schemas/line_desktop_patrol_scenario.schema.json`
  - `schemas/line_desktop_patrol_proposal.schema.json`
- sidecar root:
  - `tools/line_desktop_patrol/`
- future local artifacts:
  - `artifacts/line_desktop_patrol/runs/<run_id>/trace.json`
  - `artifacts/line_desktop_patrol/proposals/queue.jsonl`

## Non-goals in PR1
- no macOS Accessibility adapter
- no LINE Desktop UI control
- no always-on scheduler
- no Firestore write path
- no admin UI contract change
