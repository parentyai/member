# Quality Patrol Root Cause Runbook

## Scope
- analyzer entrypoint: `src/domain/qualityPatrol/analyzeRootCauses.js`
- per-issue report builder: `src/domain/qualityPatrol/rootCause/buildRootCauseReport.js`
- read-only usecase wrapper: `src/usecases/qualityPatrol/analyzeQualityIssues.js`

## Inputs
- PR-5 detection results
- PR-4 KPI envelopes
- optional evaluator results, review units, and trace bundles for richer evidence

## Core rules
- analyzer is deterministic only; no LLM judge is used in PR-6.
- symptom and cause are separated: detection issues stay as symptoms, root-cause candidates explain why they happened.
- observation blockers take priority over runtime inference.
- `blocked`, `unavailable`, and `missing` do not become quality-fail causes automatically.
- runtime code is referenced for evidence semantics only; PR-6 does not change router, readiness, finalizer, or reply behavior.

## Cause handling
- `observation_gap`, `transcript_unavailable`, and `review_unit_blocked` lead when evidence collection itself is blocked.
- runtime-style causes such as `retrieval_blocked`, `knowledge_candidate_unused`, `readiness_rejection`, `finalizer_template_collapse`, and `followup_context_loss` require supporting telemetry evidence.
- each cause candidate must include `rank`, `confidence`, `supportingEvidence`, and `evidenceGaps`.

## Non-goals in PR-6
- no registry write or backlog write
- no improvement planner
- no query route or admin UI
- no scheduler or runtime caller wiring

## Future integration
- PR-7 should consume ranked `causeCandidates` directly for improvement planning.
- planner should use `analysisStatus`, `observationBlockers`, and `evidenceGaps` before proposing implementation work.
