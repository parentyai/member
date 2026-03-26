# RUNBOOK_LINE_DESKTOP_PATROL

Local-only scaffold runbook for the LINE Desktop patrol harness.

## Preconditions
- test accounts / whitelist targets only
- PR4 still has no desktop send path
- global kill switch remains the final stop for any future side-effectful execute mode

## Validate the scaffold
1. `npm run line-desktop-patrol:validate`
2. `npm run line-desktop-patrol:state`
3. `npm run line-desktop-patrol:probe`
4. `npm run line-desktop-patrol:dry-run`
5. `npm run line-desktop-patrol:evaluate -- --trace artifacts/line_desktop_patrol/runs/<run_id>/trace.json --planning-output /tmp/line_desktop_patrol_planning.json`
6. `npm run line-desktop-patrol:enqueue-proposals -- --trace artifacts/line_desktop_patrol/runs/<run_id>/trace.json --planning-output /tmp/line_desktop_patrol_planning.json --queue-root /tmp/line_desktop_patrol_proposals`
7. optional syntax check: `python3 -m compileall tools/line_desktop_patrol/src`

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

## Optional operator check
1. Generate one local trace/eval/queue sequence with the existing dry-run + evaluate + enqueue commands.
2. Open `/admin/app?pane=quality-patrol&role=operator`.
3. Confirm `LINE Desktop Patrol (local)` shows `status / stage / queueCount / planningStatus`.
4. Switch to `audience=human` and confirm artifact paths are redacted.
