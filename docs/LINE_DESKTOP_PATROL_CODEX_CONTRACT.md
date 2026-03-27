# LINE Desktop Patrol Codex Contract

This document defines the local-only handoff between the LINE Desktop patrol queue and Codex.

## Scope
- queue entries stay local in `artifacts/line_desktop_patrol/proposals/queue.jsonl`
- every queued proposal also emits a packet in `artifacts/line_desktop_patrol/proposals/packets/<proposal_id>.codex.json`
- no Firestore write, admin write, or auto-apply path is enabled

## Queue contract
- schema root: `schemas/line_desktop_patrol_proposal.schema.json`
- required fields:
  - `proposal_id`
  - `source_trace_ids`
  - `root_cause_category`
  - `proposed_change_scope`
  - `affected_files`
  - `expected_score_delta`
  - `risk_level`
  - `requires_human_review`

## Codex packet contract
- `contract_version`: currently `line_desktop_patrol_codex_packet_v1`
- `queue_entry`: exact queue payload
- `trace_ref`: run id, trace path, scenario id, target id, failure reason
- `evaluation_ref`: planning/main artifact paths and statuses
- `proposal`: title, objective, target files, rollback hints, blockers, confidence
- `operator_summary`: summary headline/status copied from the patrol artifact when available
- `codex_task_brief`: stable brief that tells Codex to stay review-first and non-autonomous

## Safety rules
- packets are evidence for human review, not execution authority
- `requires_human_review` stays `true`
- queue entries may be de-duplicated by `proposal_id`
- repeated evidence links are written to `proposal_linkage.json` under the run directory without mutating the original trace

## Current non-goals
- no automatic backlog promotion
- no automatic PR creation from queued packets
- no automatic code modification from queue consumption

## Patch synthesis bundle
- `line-desktop-patrol:synthesize-patch` consumes one promoted proposal and emits:
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.patch_request.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.patch_request.md`
- the bundle contains:
  - promotion/worktree references
  - validation commands
  - candidate edit targets
  - operator instructions
- the bundle is still evidence for human patch work, not execution authority

## Code patch bundle
- `line-desktop-patrol:synthesize-code-patch` consumes one patch request bundle and emits:
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_patch_bundle.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_patch_bundle.md`
- the bundle adds:
  - worktree-aware file snapshots
  - preview excerpts for candidate edit files
  - stop conditions for code patch work
  - the same validation commands reused from the patch request
- the bundle still does not write code, auto-apply edits, or auto-merge

## Code edit task bundle
- `line-desktop-patrol:synthesize-code-edit` consumes one code patch bundle and emits:
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_edit_task.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_edit_task.md`
- the bundle adds:
  - per-file edit tasks
  - anchor previews for current file context
  - apply_patch hint templates
  - review checklist and stop conditions
- the bundle still does not edit files, apply code, or open a PR by itself

## Code diff draft bundle
- `line-desktop-patrol:synthesize-code-diff` consumes one code edit task bundle and emits:
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_diff_draft.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_diff_draft.md`
- the bundle adds:
  - per-file draft patch stubs
  - apply_patch-ready placeholder blocks
  - review prompts tied to the current anchor preview
  - stop conditions for manual diff drafting
- the bundle still does not apply code, commit changes, or open a PR by itself

## Code edit bundle
- `line-desktop-patrol:synthesize-code-edit-bundle` consumes one code diff draft bundle and emits:
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_edit_bundle.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_edit_bundle.md`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_edit_bundle.prompt.md`
- the bundle adds:
  - worker prompt text for a human or Codex code-edit session
  - expected outputs for the actual edit task
  - task packets copied from the diff draft with validation commands
  - stop conditions for the real code editing step
- the bundle still does not apply code, commit changes, or open a PR by itself

## Code apply draft
- `line-desktop-patrol:synthesize-code-apply-draft` consumes one code edit bundle and emits:
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_draft.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_draft.md`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_draft.patch`
- the bundle adds:
  - a reviewed patch document assembled from the current draft task packets
  - explicit apply steps before any human runs `apply_patch`
  - expected outputs and validation commands for the final review step
- the bundle still does not apply code, commit changes, or open a PR by itself

## Code apply task
- `line-desktop-patrol:synthesize-code-apply-task` consumes one code apply draft and emits:
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_task.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_task.md`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_task.prompt.md`
- the bundle adds:
  - a reviewer checklist for the final apply step
  - a worker prompt that names the prepared write set, patch document, validation commands, and stop conditions
  - expected outputs for the final human-reviewed apply task
- the bundle still does not apply code, commit changes, or open a PR by itself

## Code review packet
- `line-desktop-patrol:synthesize-code-review-packet` consumes one code apply task and emits:
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_review_packet.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_review_packet.md`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_review_packet.prompt.md`
- the bundle adds:
  - an approval checklist for the final human review before any apply step
  - a signoff prompt that captures the final review goals and stop conditions
  - expected outputs for the final human-reviewed review decision
- the bundle still does not apply code, commit changes, or open a PR by itself

## Code apply evidence
- `line-desktop-patrol:synthesize-code-apply-evidence` consumes one code review packet and emits:
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_evidence.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_evidence.md`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_evidence.prompt.md`
- the bundle adds:
  - the final evidence requirements for the reviewed apply step
  - a prompt that lists validation and signoff evidence expectations
  - expected outputs for the final evidence record after human apply review
- the bundle still does not apply code, commit changes, or open a PR by itself

## Code apply signoff
- `line-desktop-patrol:synthesize-code-apply-signoff` consumes one code apply evidence bundle and emits:
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_signoff.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_signoff.md`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_signoff.prompt.md`
- the bundle adds:
  - the final approver requirements after the evidence pass
  - a prompt that lists validation outcomes, evidence references, and go/no-go expectations
  - expected outputs for the final human signoff record before any follow-up PR update
- the bundle still does not apply code, commit changes, or open a PR by itself

## Code apply record
- `line-desktop-patrol:synthesize-code-apply-record` consumes one code apply signoff bundle and emits:
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_record.json`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_record.md`
  - `artifacts/line_desktop_patrol/proposals/promotions/<proposal_id>.code_apply_record.prompt.md`
- the bundle adds:
  - the final closure requirements after signoff, including merge or no-merge disposition
  - a prompt that lists validation outcomes, follow-up references, and rollback confirmation expectations
  - expected outputs for the final post-apply and post-merge record before the loop is marked complete
- the bundle still does not apply code, commit changes, or open a PR by itself
