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
- patch synthesis worker that turns one promoted proposal into a human-reviewed patch request bundle
- acceptance gate CLI for KPI + manual host completion checks
- machine-local operator bundle scaffold for member-only self-test acceptance
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
- `npm run line-desktop-patrol:synthesize-patch -- --proposal-id <proposal_id>`
- `npm run line-desktop-patrol:synthesize-code-patch -- --proposal-id <proposal_id>`
- `npm run line-desktop-patrol:synthesize-code-edit -- --proposal-id <proposal_id>`
- `npm run line-desktop-patrol:scaffold-operator-bundle -- --bundle-root ~/member-line-desktop-patrol --target-chat-title "メンバー"`
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
- `line-desktop-patrol:scaffold-operator-bundle` creates machine-local dry-run-only `policy.local.json`, `acceptance.manual.json`, `scenarios/execute_smoke.json`, and `soak/*` files outside the repo so operators can pin one member-only self-test chat such as `メンバー` without touching tracked config.
- `promote_proposal` prepares a branch/worktree, patch draft artifact, and draft PR body; it never auto-merges or auto-applies runtime changes.
- `synthesize_patch_task` builds `patch_request.json` and `patch_request.md` artifacts that convert one queued proposal into a human-reviewed patch brief with validation commands and candidate edit targets.
- `synthesize_code_patch_bundle` builds `code_patch_bundle.json` and `code_patch_bundle.md` artifacts with worktree-aware file snapshots so a human or Codex can write the minimal diff without broadening runtime authority.
- `synthesize_code_edit_task` builds `code_edit_task.json` and `code_edit_task.md` artifacts with per-file patch hints and review checklist so a human or Codex can draft the actual edit without auto-applying code.
- `synthesize_code_diff_draft` builds `code_diff_draft.json` and `code_diff_draft.md` artifacts with apply_patch-ready placeholder blocks so a human or Codex can draft the concrete diff without auto-applying code.
- `synthesize_code_edit_bundle` builds `code_edit_bundle.json`, `code_edit_bundle.md`, and `code_edit_bundle.prompt.md` artifacts with worker prompts and expected outputs so a human or Codex can start the real edit without auto-applying code.
- `synthesize_code_apply_draft` builds `code_apply_draft.json`, `code_apply_draft.md`, and `code_apply_draft.patch` artifacts with reviewed patch documents and apply steps so a human can prepare the final apply_patch review without auto-applying code.
- `synthesize_code_apply_task` builds `code_apply_task.json`, `code_apply_task.md`, and `code_apply_task.prompt.md` artifacts with reviewer checklist and worker prompt so a human or Codex session can execute the final reviewed apply step without auto-applying code.
- `synthesize_code_review_packet` builds `code_review_packet.json`, `code_review_packet.md`, and `code_review_packet.prompt.md` artifacts with approval checklist and signoff prompt so a human reviewer can approve the final apply task without auto-applying code.
- `synthesize_code_apply_evidence` builds `code_apply_evidence.json`, `code_apply_evidence.md`, and `code_apply_evidence.prompt.md` artifacts with final evidence requirements so a human can record the reviewed apply result without auto-applying code.
- `synthesize_code_apply_signoff` builds `code_apply_signoff.json`, `code_apply_signoff.md`, and `code_apply_signoff.prompt.md` artifacts with final approval requirements so a human can record the final go/no-go signoff without auto-applying code.
- `synthesize_code_apply_record` builds `code_apply_record.json`, `code_apply_record.md`, and `code_apply_record.prompt.md` artifacts with final closure requirements so a human can record the post-apply and post-merge outcome without auto-applying code.
- the admin `LINE Desktop Patrol (local)` panel surfaces the latest promotion kind / status / draft PR ref / updatedAt in read-only form so operators can inspect the newest promotion/apply-record artifact without opening local files.
- `retention` only touches stale raw screenshot / AX / visible artifacts by default and keeps `trace.json` / eval / queue artifacts intact.
- `acceptance_gate` writes `artifacts/line_desktop_patrol/acceptance/latest.json` and blocks completion until both KPI thresholds and machine-local soak evidence are satisfied.
- the visible-message read path reuses the existing `store_ax_tree` gate so PR11 does not expand the policy schema.
- the sample policy keeps `store_screenshots=false` and `store_ax_tree=false`, so both observations remain opt-in.
- the evaluator bridge is read-only and reuses existing `tools/quality_patrol` logic.
- the evaluator default main artifact path is `artifacts/line_desktop_patrol/evals/<run_id>/desktop_patrol_eval.json`.
- proposal queue output is local-only at `artifacts/line_desktop_patrol/proposals/queue.jsonl` unless an explicit temp path is supplied.
- proposal promotion metadata is written to `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.json`.
