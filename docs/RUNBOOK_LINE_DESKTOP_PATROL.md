# RUNBOOK_LINE_DESKTOP_PATROL

Local-only scaffold runbook for the LINE Desktop patrol harness.

## Preconditions
- test accounts / whitelist targets only
- PR6 still has no desktop send path
- global kill switch remains the final stop for any future side-effectful execute mode

## Validate the scaffold
1. `npm run line-desktop-patrol:validate`
2. `npm run line-desktop-patrol:state`
3. `npm run line-desktop-patrol:probe`
4. `npm run line-desktop-patrol:dry-run`
5. `npm run line-desktop-patrol:loop`
6. `npm run line-desktop-patrol:evaluate -- --trace artifacts/line_desktop_patrol/runs/<run_id>/trace.json --planning-output /tmp/line_desktop_patrol_planning.json`
7. `npm run line-desktop-patrol:enqueue-proposals -- --trace artifacts/line_desktop_patrol/runs/<run_id>/trace.json --planning-output /tmp/line_desktop_patrol_planning.json --queue-root /tmp/line_desktop_patrol_proposals`
8. optional syntax check: `python3 -m compileall tools/line_desktop_patrol/src`

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

## Optional operator check
1. Generate one local trace/eval/queue sequence with the existing dry-run + evaluate + enqueue commands.
2. Open `/admin/app?pane=quality-patrol&role=operator`.
3. Confirm `LINE Desktop Patrol (local)` shows `status / stage / queueCount / planningStatus`.
4. Switch to `audience=human` and confirm artifact paths are redacted.

## Optional PR6 guard check
1. Run `npm run line-desktop-patrol:loop` with `policy.example.json` and confirm the result stops with `policy_disabled_stop`.
2. Re-run with a temporary policy override where `enabled=true` during a blocked-hour fixture or a kill-switch fixture and confirm the expected stop reason is written to trace + latest summary.
3. Inspect `artifacts/line_desktop_patrol/runtime/state.json` and confirm `failure_streak` is preserved for guard stops and reset for `dry_run_only_skip`.
