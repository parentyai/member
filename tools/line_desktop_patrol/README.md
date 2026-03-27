# LINE Desktop Patrol Scaffold

Local-only scaffold for the Member LINE Desktop self-evaluation harness.

## Current scope
- policy schema and example config
- trace / proposal schema
- Python sidecar package skeleton
- read-only repo runtime state bridge
- macOS host capability probe
- dry-run harness that writes local trace evidence
- guard-enforced loop runner with local runtime state
- optional screenshot-only observation in the dry-run harness
- standalone bounded AX summary dump command
- optional AX summary observation in the dry-run harness
- standalone bounded visible-message read command
- optional visible-message observation in the dry-run harness behind the existing `store_ax_tree` gate
- bounded target validation / open target / send foundations
- OCR-assisted header fallback for target validation when LINE does not expose the active chat title through AX static text
- bounded composer click/paste/OCR fallback for send confirmation when LINE does not expose the composer AX field
- one-shot execute harness that writes trace + eval + queue artifacts
- execute loop wrapper with overlap lock
- local doctor and retention CLIs
- proposal promotion worker that prepares branch/worktree + draft PR body
- acceptance gate CLI for KPI + manual host completion checks
- read-only evaluator bridge into existing `qualityPatrol`
- append-only local proposal queue
- per-proposal Codex packet contract
- tracked sample config still keeps desktop send disabled by default
- no standalone `store_visible_messages` policy key yet

## Safe defaults
- `enabled=false`
- `dry_run_default=true`
- `auto_apply_level=none`
- whitelist targets only
- proposal queue only

## Commands
- `npm run line-desktop-patrol:validate`
- `npm run line-desktop-patrol:state`
- `npm run line-desktop-patrol:probe`
- `npm run line-desktop-patrol:dry-run`
- `npm run line-desktop-patrol:loop`
- `npm run line-desktop-patrol:open-target`
- `npm run line-desktop-patrol:send`
- `npm run line-desktop-patrol:execute-once`
- `npm run line-desktop-patrol:loop-execute`
- `npm run line-desktop-patrol:evaluate -- --trace <artifacts/.../trace.json>`
- `npm run line-desktop-patrol:enqueue-proposals -- --trace <artifacts/.../trace.json> --planning-output <artifacts/.../desktop_patrol_eval_planning.json>`
- `npm run line-desktop-patrol:promote-proposal -- --proposal-id <proposal_id>`
- `npm run line-desktop-patrol:doctor`
- `npm run line-desktop-patrol:retention`
- `npm run line-desktop-patrol:acceptance-gate -- --manual-report ~/member-line-desktop-patrol/acceptance.manual.json`
- `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.macos_adapter --dump-ax-tree --output-path /tmp/line_desktop_patrol_ax.json --execute`
- `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.macos_adapter --read-visible-messages --output-path /tmp/line_desktop_patrol_visible.json --execute --max-items 5`
- `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.macos_adapter --validate-target --execute --expected-chat-title "Codex Self Test" --expected-window-title-substring "LINE" --expected-participant-label "Self Test"`

## Layout
- `config/`
- `scenarios/`
- `launchd/`
- `src/member_line_patrol/`

## Notes
- tracked sample policy still keeps send disabled and dry-run only.
- the guarded loop writes `artifacts/line_desktop_patrol/runtime/state.json` and respects blocked hours, hourly caps, failure streak, and the repo-side kill switch before invoking the dry-run harness.
- `execute_harness` keeps fail-closed guards for `policy.enabled`, repo-side kill switch, blocked hours, failure streak, and allowlist `allowed_send_modes=["execute"]`.
- when AX/visible text do not expose the active LINE chat title, `validate_target` may capture a bounded window-header screenshot and require local OCR to match the allowlist chat title before send proceeds.
- when LINE does not expose a composer AX field, `send_text` may use a bounded composer-region click/paste path and require local OCR to confirm the echoed message before return-key send proceeds.
- `execute_loop` adds an overlap lock at `artifacts/line_desktop_patrol/runtime/execute.lock.json`.
- when `store_screenshots=true`, the dry-run harness may capture `runs/<run_id>/after.png` on macOS and record it in `screenshot_after`.
- when `store_ax_tree=true`, the dry-run harness may capture `runs/<run_id>/after.ax.json` on macOS and record it in `ax_tree_after`.
- when `store_ax_tree=true`, the dry-run harness may also capture `runs/<run_id>/after.visible.json` and populate `visible_after` with bounded `unknown` role rows.
- when `execute_once` succeeds, the harness writes `trace.json`, `summary.json`, local eval artifacts, proposal linkage, and queue artifacts under the same run id.
- `promote_proposal` only prepares a branch/worktree and draft PR body; it never auto-merges or auto-applies runtime changes.
- `retention` only touches stale raw screenshot / AX / visible artifacts by default and keeps `trace.json` / eval / queue artifacts intact.
- `acceptance_gate` writes `artifacts/line_desktop_patrol/acceptance/latest.json` and blocks completion until both KPI thresholds and machine-local soak evidence are satisfied.
- the visible-message read path reuses the existing `store_ax_tree` gate so PR11 does not expand the policy schema.
- the sample policy keeps `store_screenshots=false` and `store_ax_tree=false`, so both observations remain opt-in.
- the evaluator bridge is read-only and reuses existing `tools/quality_patrol` logic.
- the evaluator default main artifact path is `artifacts/line_desktop_patrol/evals/<run_id>/desktop_patrol_eval.json`.
- proposal queue output is local-only at `artifacts/line_desktop_patrol/proposals/queue.jsonl` unless an explicit temp path is supplied.
- proposal promotion metadata is written to `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.json`.
