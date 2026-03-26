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
