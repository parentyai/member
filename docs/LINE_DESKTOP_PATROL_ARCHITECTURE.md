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

## PR9 Additions
- `member_line_patrol.dry_run_harness` は `policy.store_ax_tree=true` のときだけ AX summary dump を試行し、成功時は `ax_tree_after` に local artifact path を記録する
- sample policy は `store_screenshots=false` と `store_ax_tree=false` を維持し、default dry-run command が新しい observation を勝手に実行しないようにする
- AX dump failure は screenshot observation と同様に trace evidence へ degrade し、desktop send / visible-message read / evaluator write path はまだ行わない

## PR10 Additions
- `member_line_patrol.macos_adapter.plan_read_visible_messages` / `execute_read_visible_messages` で bounded visible text read を追加する
- visible text read は `osascript` を timeout 付きで実行し、非 macOS / command unavailable / permission error / timeout では skipped or failed observation に degrade する
- PR10 では standalone command + MCP manifest のみで、dry-run harness / guarded loop / evaluator / admin read model への配線はまだ行わない

## PR11 Additions
- `member_line_patrol.dry_run_harness` は `policy.store_ax_tree=true` のときだけ visible-message read も試行し、成功時は `visible_after` と `observation_artifacts.read_visible_messages` に local evidence を残す
- PR11 は policy schema を増やさず、Accessibility 系 observation の既存 gate として `store_ax_tree` を再利用する
- visible-message read failure は AX dump と同様に degraded local observation として残し、desktop send / evaluator write / admin write path はまだ行わない

## PR12 Additions
- `member_line_patrol.macos_adapter` に `validate_target`, `open_test_chat`, `send_text` の bounded foundation を追加する
- target validation は `expected_chat_title`, `expected_window_title_substring`, `expected_participant_labels`, `expected_ax_fingerprint` の一致で fail-closed する
- LINE が active chat title を AX static text として露出しない場合に備えて、bounded window-header screenshot + local OCR fallback を使って `expected_chat_title` を再確認できる
- tracked sample policy / allowed_targets は `dry_run` のまま固定し、execute は machine-local override のみで有効化する

## PR13 Additions
- `member_line_patrol.execute_harness` で one-shot execute state machine を追加する
- one-shot execute は `before/after` の screenshot / AX / visible text を同一 run root に書き、trace / eval / proposal queue を 1 コマンドで閉じる
- send 後の reply 観測が欠けても trace は残し、`post_send_reply_missing` / `post_send_reply_ambiguous` として degrade する
- LINE が composer AX field を露出しない場合に備えて、bounded composer-region click/paste + local OCR echo confirmation fallback を使い、確認できた場合だけ return-key send に進む

## PR14 Additions
- `buildConversationReviewUnitsFromDesktopTrace` は execute trace の `unknown` visible rows から `sent_text` と post-send diff を使って `userMessage` / `assistantReply` を推定する
- execute trace は `target_validation_failed`, `send_not_confirmed`, `post_send_reply_missing`, `visible_correlation_ambiguous` blocker を add-only で持つ
- `desktopPatrolSummary` は execute 系の `executionMode`, `sendStatus`, `targetValidationStatus`, `replyObservationStatus`, `lastRunKind` を read-only で返す

## PR15 Additions
- `member_line_patrol.promote_proposal` で proposal queue から branch/worktree/draft PR body を準備する
- promotion record は `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.json` に保存し、draft PR URL があれば summary 側に read-only で出す
- proposal promotion は human review 前提で、runtime auto-apply や auto-merge は行わない

## PR16-17 Additions
- `member_line_patrol.execute_loop` で overlap lock 付きの scheduled execute wrapper を追加する
- `member_line_patrol.doctor` で host/policy/runtime/latest-summary を一括診断できる
- `member_line_patrol.retention` で raw screenshot / AX / visible artifacts の local retention dry-run/apply を追加する
- `tools/line_desktop_patrol/launchd/com.member.line-desktop-patrol.execute-loop.plist.example` で launchd 定期起動の例を示す

## PR18 Additions
- `member_line_patrol.acceptance_gate` で automatic KPI と machine-local manual soak report をまとめて completion gate 化する
- `member_line_patrol.execute_harness` は send 直前に repo-side runtime state を再読込し、kill switch が mid-run で flipped した場合も fail-closed で停止する
- failure injection contract tests は target mismatch / echo mismatch / post-send reply gap / mid-run kill switch を CI 上で再現する

## PR19 Additions
- `tools/line_desktop_patrol/scaffold_operator_bundle.js` で machine-local operator bundle を生成し、member-only self-test chat 用の `policy.local.json`, `acceptance.manual.json`, `scenarios/execute_smoke.json`, `soak/*` を repo 外へ作成する
- scaffolded bundle は tracked config と同じ安全既定値を維持し、member-only self-test chat 例えば `メンバー` を明示で pin するまで execute enablement に進まない
- `member_line_patrol.promote_proposal` は draft PR body に加えて `patch_draft.md` を生成し、proposal queue から reviewable な patch intent artifact を残す

## PR20 Additions
- `member_line_patrol.synthesize_patch_task` で proposal promotion artifacts を `patch_request.json` / `patch_request.md` に正規化し、candidate edits と validation commands を human-reviewed bundle として出力する
- patch synthesis bundle は worktree と branch を再利用するが、code diff や auto-apply を自動生成しない
- MCP manifest は `synthesize_patch_bundle` を `patch_task_ready` として公開し、operator tooling が proposal から patch 着手パケットへ進める

## PR21 Additions
- `member_line_patrol.synthesize_code_patch_bundle` で patch request artifacts を worktree-aware な `code_patch_bundle.json` / `code_patch_bundle.md` に正規化する
- code patch bundle は affected file ごとの preview snapshot と stop conditions を追加し、人間または Codex が最小 diff を書く前の編集土台を固定する
- MCP manifest は `synthesize_code_patch_bundle` を `code_patch_bundle_ready` として公開し、bundle は引き続き artifact-only で code auto-apply を持たない

## Boundaries
- Python sidecar:
  - policy load
  - runtime state model
  - host capability probe
  - bounded LINE app open/focus planning
  - dry-run harness
  - execute harness
  - execute loop wrapper
  - trace store skeleton
  - doctor / retention helpers
  - proposal promotion worker
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
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.patch_draft.md`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.patch_request.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.patch_request.md`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_patch_bundle.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_patch_bundle.md`
  - `artifacts/line_desktop_patrol/acceptance/latest.json`
  - `artifacts/line_desktop_patrol/runs/<run_id>/proposal_linkage.json`
  - `artifacts/line_desktop_patrol/runtime/state.json`
  - `artifacts/line_desktop_patrol/runtime/execute.lock.json`
  - `artifacts/line_desktop_patrol/runs/<run_id>/after.visible.json`
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

## Non-goals in PR9
- no desktop send
- no visible message read
- no automatic AX dump in the default sample policy
- no AX artifact promotion into evaluator or admin read models

## Non-goals in PR10
- no desktop send
- no visible-message wiring into the default dry-run command
- no visible-message promotion into evaluator or admin read models
- no visible-message retention contract beyond local ad hoc output paths

## Ongoing non-goals
- no tracked sample config that enables execute by default
- no automatic runtime/code apply from execute runs
- no automatic merge or deploy from proposal promotion
- no off-whitelist send path
