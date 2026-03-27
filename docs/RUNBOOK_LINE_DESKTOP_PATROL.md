# RUNBOOK_LINE_DESKTOP_PATROL

Local-only scaffold runbook for the LINE Desktop patrol harness.

## Preconditions
- test accounts / whitelist targets only
- tracked sample config still has no desktop send path
- global kill switch remains the final stop for any future side-effectful execute mode

## Validate the scaffold
1. `npm run line-desktop-patrol:validate`
2. `npm run line-desktop-patrol:scaffold-operator-bundle -- --bundle-root ~/member-line-desktop-patrol --target-chat-title "メンバー"`
3. `npm run line-desktop-patrol:state`
4. `npm run line-desktop-patrol:probe`
5. `npm run line-desktop-patrol:dry-run`
6. `npm run line-desktop-patrol:loop`
7. `npm run line-desktop-patrol:open-target -- --policy ~/member-line-desktop-patrol/policy.local.json --scenario ~/member-line-desktop-patrol/scenarios/execute_smoke.json`
8. `npm run line-desktop-patrol:send -- --policy ~/member-line-desktop-patrol/policy.local.json --scenario ~/member-line-desktop-patrol/scenarios/execute_smoke.json --message-text "self test message"`
9. `npm run line-desktop-patrol:execute-once -- --policy ~/member-line-desktop-patrol/policy.local.json --scenario ~/member-line-desktop-patrol/scenarios/execute_smoke.json`
10. `npm run line-desktop-patrol:loop-execute -- --policy ~/member-line-desktop-patrol/soak/policy.soak.json --scenario ~/member-line-desktop-patrol/scenarios/execute_smoke.json`
11. `npm run line-desktop-patrol:evaluate -- --trace artifacts/line_desktop_patrol/runs/<run_id>/trace.json --planning-output /tmp/line_desktop_patrol_planning.json`
12. `npm run line-desktop-patrol:enqueue-proposals -- --trace artifacts/line_desktop_patrol/runs/<run_id>/trace.json --planning-output /tmp/line_desktop_patrol_planning.json --queue-root /tmp/line_desktop_patrol_proposals`
13. `npm run line-desktop-patrol:promote-proposal -- --proposal-id <proposal_id>`
14. `npm run line-desktop-patrol:synthesize-patch -- --proposal-id <proposal_id>`
15. `npm run line-desktop-patrol:synthesize-code-patch -- --proposal-id <proposal_id>`
16. `npm run line-desktop-patrol:synthesize-code-edit -- --proposal-id <proposal_id>`
17. `npm run line-desktop-patrol:doctor`
18. `npm run line-desktop-patrol:retention`
19. `npm run line-desktop-patrol:acceptance-gate -- --manual-report ~/member-line-desktop-patrol/acceptance.manual.json`
20. optional syntax check: `python3 -m compileall tools/line_desktop_patrol/src`

## Machine-local operator bundle
- `line-desktop-patrol:scaffold-operator-bundle` only writes outside the repo.
- the generated bundle keeps `enabled=false`, `dry_run_default=true`, and `allowed_send_modes=["dry_run"]`.
- operators must pin exactly one member-only self-test LINE chat, for example `メンバー`, before any execute enablement.
- the generated bundle includes:
  - `policy.local.json`
  - `acceptance.manual.json`
  - `scenarios/execute_smoke.json`
  - `soak/policy.soak.json`
  - `soak/acceptance.soak.json`
  - `README.md`
- execute enablement must remain machine-local:
  - set `enabled=true`
  - set `dry_run_default=false`
  - set `allowed_targets[0].allowed_send_modes=["execute"]`
  - keep the target title fixed to the member-only self-test chat

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
- probe command:
  - prints `is_macos`
  - prints `open` / `osascript` / `screencapture` availability
  - prints whether `LINE.app` is present in standard application paths
- dry-run command:
  - writes `artifacts/line_desktop_patrol/runs/<run_id>/trace.json`
  - writes `artifacts/line_desktop_patrol/runs/<run_id>/summary.json`
  - records `dry_run_only_skip` instead of sending any message
- loop command:
  - enforces `policy.enabled`, repo-side kill switch, `blocked_hours`, `max_runs_per_hour`, and `failure_streak_threshold`
  - writes `artifacts/line_desktop_patrol/runtime/state.json`
  - refreshes `tmp/line_desktop_patrol_latest.json`
  - emits a guard trace with `failure_reason` like `policy_disabled_stop`, `kill_switch_stop`, `blocked_hours_skip`, `max_runs_per_hour_skip`, or `failure_streak_stop` before any dry-run trace is attempted
- open-target / send / execute-once:
  - all require a machine-local override where `enabled=true` and the selected target allows `execute`
  - `open-target` validates the frontmost LINE chat and only attempts a uniquely matched allowlist target click
  - `send` only proceeds after target validation and composer echo confirmation succeed
  - if LINE does not expose chat title via AX static text, target validation may use bounded window-header OCR before send proceeds
  - if LINE does not expose the composer AX field, send may use a bounded composer click/paste fallback and requires OCR echo confirmation before return-key send proceeds
  - `execute-once` writes `before/after` evidence plus trace/eval/queue artifacts under one run id
- execute loop:
  - acquires `artifacts/line_desktop_patrol/runtime/execute.lock.json`
  - skips with `overlap_run_skip` while a fresh lock is active
  - is intended for launchd or operator-scheduled runs, not for tracked sample config
- screenshot observation:
  - when `store_screenshots=true`, `line-desktop-patrol:dry-run` may capture `artifacts/line_desktop_patrol/runs/<run_id>/after.png`
  - on non-macOS hosts or when `screencapture` is unavailable, the trace records a skipped observation instead of failing the run
- AX observation:
  - when `store_ax_tree=true`, `line-desktop-patrol:dry-run` may capture `artifacts/line_desktop_patrol/runs/<run_id>/after.ax.json`
  - on non-macOS hosts or when `osascript` / Accessibility permission is unavailable, the trace records a skipped or failed observation instead of failing the run
- visible-message read:
  - `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.macos_adapter --read-visible-messages --output-path /tmp/line_desktop_patrol_visible.json --execute --max-items 5 --timeout-seconds 2` runs a standalone bounded read
  - on non-macOS hosts or when `osascript` / Accessibility permission is unavailable, the command returns a skipped or failed observation instead of enabling any send path
  - when `store_ax_tree=true`, `line-desktop-patrol:dry-run` also attempts a bounded visible-message read and stores `unknown` role rows into `visible_after`
- evaluate command:
  - reads one local trace file
  - converts the trace into one review unit
  - runs the existing `qualityPatrol` evaluator / detection / planning pipeline in read-only mode
  - writes `artifacts/line_desktop_patrol/evals/<run_id>/desktop_patrol_eval.json` by default plus any optional planning artifact
- enqueue-proposals command:
  - reads one trace + one planning artifact
  - appends schema-compliant rows into a local-only `queue.jsonl`
  - writes `packets/<proposal_id>.codex.json`
  - writes `proposal_linkage.json` next to the source trace
- promote-proposal command:
  - reads one queue row and one Codex packet
  - prepares a dedicated git branch/worktree, a patch draft file, and a draft PR body file
  - only creates a GitHub draft PR when the prepared branch already has a code diff and the proposal is not blocked by risk policy
- synthesize-patch command:
  - reads the proposal promotion record, queue row, and Codex packet
  - writes `patch_request.json` and `patch_request.md` under `artifacts/line_desktop_patrol/proposals/promotions/`
  - includes candidate edit targets, validation commands, and human-only stop conditions
  - does not auto-apply edits or create a code diff by itself
- synthesize-code-patch command:
  - reads the patch request bundle and prepared worktree
  - writes `code_patch_bundle.json` and `code_patch_bundle.md` under `artifacts/line_desktop_patrol/proposals/promotions/`
  - snapshots candidate edit files with bounded previews and workspace paths
  - still does not auto-apply edits or create a code diff by itself
- synthesize-code-edit command:
  - reads the code patch bundle and prepared worktree
  - writes `code_edit_task.json` and `code_edit_task.md` under `artifacts/line_desktop_patrol/proposals/promotions/`
  - derives per-file edit tasks, patch hint templates, and review checklist items
  - still does not auto-apply edits or create a code diff by itself
- synthesize-code-diff command:
  - reads the code edit task bundle and prepared worktree
  - writes `code_diff_draft.json` and `code_diff_draft.md` under `artifacts/line_desktop_patrol/proposals/promotions/`
  - derives per-file draft patch stubs and apply_patch placeholder blocks
  - still does not auto-apply edits, commit code, or create a code diff by itself
- synthesize-code-edit-bundle command:
  - reads the code diff draft bundle and prepared worktree
  - writes `code_edit_bundle.json`, `code_edit_bundle.md`, and `code_edit_bundle.prompt.md` under `artifacts/line_desktop_patrol/proposals/promotions/`
  - derives worker prompt text, expected outputs, and task packets for the actual code editing step
  - still does not auto-apply edits, commit code, or create a PR by itself
- synthesize-code-apply-draft command:
  - reads the code edit bundle and prepared worktree
  - writes `code_apply_draft.json`, `code_apply_draft.md`, and `code_apply_draft.patch` under `artifacts/line_desktop_patrol/proposals/promotions/`
  - derives reviewed patch documents and apply steps for the final human review before running `apply_patch`
  - still does not auto-apply edits, commit code, or create a PR by itself
- synthesize-code-apply-task command:
  - reads the code apply draft and prepared worktree
  - writes `code_apply_task.json`, `code_apply_task.md`, and `code_apply_task.prompt.md` under `artifacts/line_desktop_patrol/proposals/promotions/`
  - derives a reviewer checklist, worker prompt, and expected outputs for the final human-reviewed apply step
  - still does not auto-apply edits, commit code, or create a PR by itself
- synthesize-code-review-packet command:
  - reads the code apply task and prepared worktree
  - writes `code_review_packet.json`, `code_review_packet.md`, and `code_review_packet.prompt.md` under `artifacts/line_desktop_patrol/proposals/promotions/`
  - derives the final approval checklist and signoff prompt for the human review step before any apply action
  - still does not auto-apply edits, commit code, or create a PR by itself
- synthesize-code-apply-evidence command:
  - reads the code review packet and prepared worktree
  - writes `code_apply_evidence.json`, `code_apply_evidence.md`, and `code_apply_evidence.prompt.md` under `artifacts/line_desktop_patrol/proposals/promotions/`
  - derives the final evidence requirements and signoff expectations after the reviewed apply step
  - still does not auto-apply edits, commit code, or create a PR by itself
- synthesize-code-apply-signoff command:
  - reads the code apply evidence bundle and prepared worktree
  - writes `code_apply_signoff.json`, `code_apply_signoff.md`, and `code_apply_signoff.prompt.md` under `artifacts/line_desktop_patrol/proposals/promotions/`
  - derives the final go/no-go signoff requirements after the evidence pass
  - still does not auto-apply edits, commit code, or create a PR by itself
- synthesize-code-apply-record command:
  - reads the code apply signoff bundle and prepared worktree
  - writes `code_apply_record.json`, `code_apply_record.md`, and `code_apply_record.prompt.md` under `artifacts/line_desktop_patrol/proposals/promotions/`
  - derives the final closure record requirements after the signoff step
  - still does not auto-apply edits, commit code, or create a PR by itself
- doctor command:
  - reports host capability, policy readiness, runtime visibility, loop state, and latest summary presence
- retention command:
  - dry-run by default
  - only deletes stale raw screenshot / AX / visible artifacts when `--apply` is passed
- acceptance gate command:
  - writes `artifacts/line_desktop_patrol/acceptance/latest.json`
  - computes automatic KPI thresholds from local execute traces and promotion records
  - remains `blocked` until a machine-local manual acceptance report is supplied and meets the soak thresholds

## Stop and rollback
- local scaffold stop:
  - keep `enabled=false` in local policy
  - do not wire a background runner yet
  - stop invoking `npm run line-desktop-patrol:loop`
- future execute-path emergency stop:
  - use the existing admin kill-switch flow
- rollback:
  - revert the scaffold PR
  - remove local example configs if they were copied into a machine-local override

## PR1 guardrails
- no desktop automation implementation
- no screenshot or AX dump retention yet
- no promotion into backlog collections

## PR2 guardrails
- bounded app open/focus planning only
- no execute path in the default npm command
- no screenshot capture execution in the default npm command
- no target switching beyond the whitelist alias selected in policy

## PR3 guardrails
- evaluator bridge stays read-only
- existing Firestore registry / backlog repos are not written from desktop traces
- proposal output is artifact-only until a later PR wires queue promotion

## PR4 guardrails
- proposal queue stays local filesystem-only
- every queue row keeps `requires_human_review=true`
- no Firestore backlog promotion
- no Codex-triggered auto-apply path

## PR5 guardrails
- `/admin/app?pane=quality-patrol` is read-only and does not mutate queue artifacts
- `desktopPatrolSummary` is nested under the existing `GET /api/admin/quality-patrol` response
- operator audience may inspect artifact paths, but human audience stays redacted

## PR6 guardrails
- guarded loop remains local CLI only
- loop stop/skip decisions still write trace evidence for operator review
- guarded loop does not enable desktop send, AX dump, screenshot capture, or proposal auto-apply
- latest summary and loop state are filesystem-only and can be discarded by removing local artifacts

## PR7 guardrails
- screenshot capture stays opt-in via `store_screenshots=true`
- the sample policy remains `store_screenshots=false`
- screenshot capture does not imply AX dump, visible-message read, or send enablement
- screenshot capture failures degrade to trace evidence and do not write to Firestore

## PR8 guardrails
- AX summary dump is standalone and not wired into the default dry-run command
- AX summary dump uses a bounded timeout and may return `ax_timeout`
- AX summary dump does not enable visible-message read or send
- AX summary output remains local filesystem-only

## PR9 guardrails
- AX observation stays opt-in via `store_ax_tree=true`
- the sample policy remains `store_ax_tree=false`
- AX dump failures degrade to trace evidence and do not write to Firestore
- AX observation does not imply visible-message read or send enablement

## PR10 guardrails
- visible-message read stays standalone and is not wired into the default dry-run command
- visible-message read uses `--max-items` and a timeout-bounded `osascript` execution
- visible-message read failures degrade to skipped or failed local observations and do not write to Firestore
- visible-message read does not imply desktop send enablement

## PR11 guardrails
- dry-run visible-message observation reuses the existing `store_ax_tree=true` gate and does not add a new policy key
- visible-message rows stay bounded and speaker attribution remains `unknown`
- visible-message observation failures do not block AX observation or write to Firestore
- visible-message observation does not imply desktop send enablement

## Execute guardrails
- tracked `policy.example.json` and `allowed_targets.example.json` remain dry-run only
- execute enablement requires machine-local override plus `allowed_send_modes=["execute"]`
- `send_text` fails closed on target mismatch, blocked hours, kill switch, failure streak, or composer echo mismatch
- OCR-assisted validation and composer fallback remain bounded to the active LINE window and must still match the allowlist target title before any send is attempted
- `execute_harness` re-reads repo-side runtime state immediately before send and aborts if kill switch becomes true mid-run
- proposal promotion never auto-merges and does not auto-apply code changes
- launchd scheduling is optional and should only target local override configs

## PR18 completion gate
1. Copy `tools/line_desktop_patrol/config/acceptance.manual.example.json` to a machine-local path outside the repo.
2. Restrict the machine-local policy to one member-only self-test target, for example `メンバー`.
3. Run `execute_once` against that target until `execute_once_attempted >= 10` and `execute_once_passed == execute_once_attempted`.
4. Run scheduled execute on the same host until `scheduled_execute_attempted >= 50` and `scheduled_execute_passed == scheduled_execute_attempted`.
5. Mark `accessibility_granted=true`, `screen_recording_granted=true`, and `self_test_target_ready=true` in the machine-local manual report.
6. Run `npm run line-desktop-patrol:acceptance-gate -- --manual-report <path>` and confirm:
   - `overallStatus=ready`
   - `automatic.status=ready`
   - `manual.status=ready`
   - `offWhitelistSendIncidents=0`
   - `targetMismatchFalseNegativeCount=0`
   - `sendSuccessRate >= 0.99`
   - `observeSuccessRate >= 0.95`
   - `replyCorrelationUsableRate >= 0.80`
   - `draftPrDuplicateRate = 0`

## Optional operator check
1. Generate one local trace/eval/queue sequence with the existing dry-run + evaluate + enqueue commands.
2. Open `/admin/app?pane=quality-patrol&role=operator`.
3. Confirm `LINE Desktop Patrol (local)` shows `status / stage / queueCount / planningStatus`.
4. Switch to `audience=human` and confirm artifact paths are redacted.

## Optional PR6 guard check
1. Run `npm run line-desktop-patrol:loop` with `policy.example.json` and confirm the result stops with `policy_disabled_stop`.
2. Re-run with a temporary policy override where `enabled=true` during a blocked-hour fixture or a kill-switch fixture and confirm the expected stop reason is written to trace + latest summary.
3. Inspect `artifacts/line_desktop_patrol/runtime/state.json` and confirm `failure_streak` is preserved for guard stops and reset for `dry_run_only_skip`.

## Optional PR7 screenshot check
1. Copy `tools/line_desktop_patrol/config/policy.example.json` to a local override and set `enabled=true`, `blocked_hours=[]`, `store_screenshots=true`.
2. Run `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.dry_run_harness --policy <override> --scenario tools/line_desktop_patrol/scenarios/smoke_dry_run.example.json --output-root artifacts/line_desktop_patrol --route-key line-desktop-patrol --allow-disabled-policy`.
3. On macOS with Screen Recording permission, confirm `runs/<run_id>/after.png` exists and `trace.json` points `screenshot_after` to that file.
4. On non-macOS or without `screencapture`, confirm the trace keeps `screenshot_after=null` and records a skipped screenshot observation instead of failing the run.

## Optional PR8 AX summary check
1. Run `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.macos_adapter --dump-ax-tree --output-path /tmp/line_desktop_patrol_ax.json --execute --target-process-name LINE --timeout-seconds 2`.
2. If Accessibility permission is already granted and LINE is running, confirm `/tmp/line_desktop_patrol_ax.json` contains `process_name / frontmost / window_count / window_name / ui_elements_enabled`.
3. If the host prompts or blocks `System Events`, confirm the command exits quickly with `reason=ax_timeout` or `reason=osascript_failed` instead of hanging indefinitely.

## Optional PR9 dry-run AX check
1. Copy `tools/line_desktop_patrol/config/policy.example.json` to a local override and set `enabled=true`, `blocked_hours=[]`, `store_ax_tree=true`.
2. Run `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.dry_run_harness --policy <override> --scenario tools/line_desktop_patrol/scenarios/smoke_dry_run.example.json --output-root artifacts/line_desktop_patrol --route-key line-desktop-patrol --allow-disabled-policy`.
3. If Accessibility permission is already granted and LINE is running, confirm `runs/<run_id>/after.ax.json` exists and `trace.json` points `ax_tree_after` to that file.
4. If the host blocks `System Events`, confirm the trace keeps `ax_tree_after=null` and records `ax_dump_skipped_pr9` or a degraded AX observation instead of failing the run.

## Optional PR10 visible-message check
1. Run `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.macos_adapter --read-visible-messages --output-path /tmp/line_desktop_patrol_visible.json --execute --target-process-name LINE --max-items 5 --timeout-seconds 2`.
2. If Accessibility permission is already granted and LINE is frontmost, confirm `/tmp/line_desktop_patrol_visible.json` contains `target_process_name / max_items / item_count / items[]`.
3. If the host blocks `System Events`, confirm the command exits quickly with `reason=visible_read_timeout` or `reason=osascript_failed` instead of hanging indefinitely.

## Optional PR11 dry-run visible-message check
1. Copy `tools/line_desktop_patrol/config/policy.example.json` to a local override and set `enabled=true`, `blocked_hours=[]`, `store_ax_tree=true`.
2. Run `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.dry_run_harness --policy <override> --scenario tools/line_desktop_patrol/scenarios/smoke_dry_run.example.json --output-root artifacts/line_desktop_patrol --route-key line-desktop-patrol --allow-disabled-policy`.
3. If Accessibility permission is already granted and LINE is frontmost, confirm `trace.json` includes `visible_after[]` and `observation_artifacts.read_visible_messages.output_path`, and confirm `runs/<run_id>/after.visible.json` exists.
4. If the host blocks `System Events`, confirm `visible_after=[]` and `observation_artifacts.read_visible_messages.reason` captures the degraded result without failing the dry run.
