# LINE_DESKTOP_PATROL_ARCHITECTURE

macOS 上の LINE Desktop を対象にした閉域 self-evaluation harness の add-only scaffold。

## PR1 Scope
- `tools/line_desktop_patrol/` に Python sidecar の骨組みを隔離する
- `schemas/line_desktop_patrol_*.schema.json` で policy / trace / scenario / proposal 契約を固定する
- `tools/line_desktop_patrol/read_repo_runtime_state.js` で repo-side の global runtime state を read-only 取得する
- no send / no AX / no screenshot のまま safety defaults をコード化する

## PR2 Additions
- `member_line_patrol.macos_adapter` で host capability probe と bounded open/focus command planning を追加する
- `member_line_patrol.dry_run_harness` で local-only dry-run trace emission を追加する
- dry-run harness は local artifact を出力するが、desktop send / AX dump / visible-message read はまだ行わない

## PR3 Additions
- `src/usecases/qualityPatrol/buildConversationReviewUnitsFromDesktopTrace.js` で desktop trace を既存 review unit 契約へ正規化する
- `tools/quality_patrol/run_desktop_patrol_eval.js` で desktop trace を既存 `qualityPatrol` pipeline に read-only 接続する
- desktop evaluator bridge は proposal を生成するが、Firestore write や backlog promotion はまだ行わない

## PR4 Additions
- `member_line_patrol.enqueue_eval_proposals` で eval artifact を local proposal queue に append-only 連携する
- `member_line_patrol.proposal_builder` で `recommendedPr` を schema-compliant queue row と Codex packet へ正規化する
- queue row と packet は filesystem-only で、trace 本体を書き換えず `proposal_linkage.json` を sidecar 出力する

## PR5 Additions
- `src/usecases/qualityPatrol/queryLatestDesktopPatrolSummary.js` で local artifact root を read-only 集約する
- `GET /api/admin/quality-patrol` は既存 contract を維持したまま nested `desktopPatrolSummary` を add-only で返す
- `/admin/app?pane=quality-patrol` の既存 pane-detail へ local desktop patrol summary を read-only 表示する
- operator audience は artifact path を保持し、human audience は redacted displayPath のみ表示する

## PR6 Additions
- `member_line_patrol.loop_state` で local loop state を `artifacts/line_desktop_patrol/runtime/state.json` に add-only 保存する
- `member_line_patrol.patrol_loop` で policy / blocked_hours / max_runs_per_hour / failure_streak / repo-side kill switch を先に判定する guarded loop を追加する
- guarded loop は skip/stop 時も trace + latest summary を書くが、desktop send / AX dump / visible-message read はまだ行わない

## PR7 Additions
- `member_line_patrol.macos_adapter.execute_capture_screenshot` で bounded `screencapture -x` 実行を追加する
- `member_line_patrol.dry_run_harness` は `policy.store_screenshots=true` のときだけ screenshot capture を試行し、成功時は `screenshot_after` に local artifact path を記録する
- screenshot capture は observation-only で、desktop send / AX dump / visible-message read はまだ行わない

## PR8 Additions
- `member_line_patrol.macos_adapter.plan_dump_ax_tree` / `execute_dump_ax_tree` で bounded AX summary dump を追加する
- AX summary dump は `osascript` を timeout 付きで実行し、permission/prompt で詰まる host でも `ax_timeout` / `host_not_macos` / `osascript_unavailable` に degrade する
- PR8 では standalone command のみで、dry-run harness / guarded loop / evaluator への配線はまだ行わない

## Boundaries
- Python sidecar:
  - policy load
  - runtime state model
  - host capability probe
  - bounded LINE app open/focus planning
  - dry-run harness
  - trace store skeleton
  - proposal queue + Codex packet writer
  - MCP manifest skeleton
- Node bridge:
  - git sha
  - Firestore project id resolution
  - `system_flags/phase0`
  - phase48 automation config
- Existing runtime:
  - webhook / notification / admin write path is unchanged in PR1
  - desktop eval bridge reuses the existing `qualityPatrol` evaluator / detection / planning pipeline in read-only mode

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
  - `artifacts/line_desktop_patrol/evals/<run_id>/desktop_patrol_eval.json`
  - `artifacts/line_desktop_patrol/proposals/queue.jsonl`
  - `artifacts/line_desktop_patrol/proposals/packets/<proposal_id>.codex.json`
  - `artifacts/line_desktop_patrol/runs/<run_id>/proposal_linkage.json`
  - `artifacts/line_desktop_patrol/runtime/state.json`
  - `tmp/line_desktop_patrol_latest.json`

## Non-goals in PR1
- no macOS Accessibility adapter
- no LINE Desktop UI control
- no always-on scheduler
- no Firestore write path
- no admin UI contract change

## Non-goals in PR2
- no desktop send
- no AX tree dump
- no visible message read
- no evaluator bridge
- no automatic proposal promotion

## Non-goals in PR3
- no Firestore write path for issues or backlog
- no MCP tool that executes evaluator-triggered changes
- no automatic proposal queue promotion

## Non-goals in PR4
- no admin UI inbox for desktop patrol proposals
- no queue-to-Firestore promotion
- no automatic PR creation from Codex packets

## Non-goals in PR5
- no new admin write route
- no queue mutation from browser
- no backlog promotion from the admin pane
- no retention / cleanup operation in the operator surface

## Non-goals in PR6
- no desktop send
- no AX tree dump
- no visible message read
- no screenshot capture execution
- no background scheduler wiring

## Non-goals in PR7
- no desktop send
- no AX tree dump
- no visible message read
- no screenshot capture requirement in the default sample policy
- no screenshot promotion into admin/browser write paths

## Non-goals in PR8
- no desktop send
- no visible message read
- no automatic AX dump during the default dry-run command
- no AX artifact promotion into evaluator or admin read models
