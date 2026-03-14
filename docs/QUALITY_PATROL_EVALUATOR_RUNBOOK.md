# Quality Patrol Evaluator Runbook

## Scope
- PR-3 introduces a deterministic-only evaluator for Quality Patrol review units.
- evaluator input: `src/usecases/qualityPatrol/evaluateConversationReviewUnits.js`
- evaluator domain entry: `src/domain/qualityPatrol/evaluateConversationQuality.js`

## Contract
- evaluator reads `reviewUnit` only and does not write to `quality_issue_registry` or `quality_improvement_backlog`.
- evaluator returns `signals`, `issueCandidates`, `supportingEvidence`, and `observationBlockers`.
- provenance is fixed to `review_unit`.

## Signal semantics
- quality signals (`naturalness`, `continuity`, `specificity`, `proceduralUtility`, `knowledgeUse`) use higher-is-better scores.
- `fallbackRepetition` is a risk score, so higher means more repetition risk.
- statuses are `pass|warn|fail|blocked|unavailable`.

## Blocked vs unavailable
- `blocked`: evidence is missing for a judgement that should have been possible.
- `unavailable`: the review unit does not expose enough signals for that dimension, so the evaluator declines to score it.
- evaluator-specific blocker examples:
  - `insufficient_context_for_followup_judgement`
  - `insufficient_knowledge_signals`
  - `insufficient_trace_evidence`

## Non-goals
- no registry upsert
- no detector/planner automation
- no admin route or scheduler
- no LLM judge

## Future integration
- PR-4 should aggregate evaluator outputs into KPI envelopes.
- PR-5 should consume `issueCandidates` and `supportingEvidence` without changing this evaluator contract.
- PR-4 KPI builder keeps evaluator output read-only and does not back-write registry or backlog records.
