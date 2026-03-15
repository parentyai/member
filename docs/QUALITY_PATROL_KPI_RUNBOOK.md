# Quality Patrol KPI Runbook

## Scope
- PR-4 introduces read-only KPI aggregation over evaluator outputs.
- builder entrypoint: `src/domain/qualityPatrol/buildPatrolKpis.js`
- usecase entrypoint: `src/usecases/qualityPatrol/buildPatrolKpisFromEvaluations.js`

## Contract
- KPI builder consumes evaluator results and review units only.
- KPI builder may include add-only transcript coverage diagnostics derived from read-side snapshot outcome telemetry in `llm_action_logs`.
- KPI builder does not write to `quality_issue_registry` or `quality_improvement_backlog`.
- provenance is fixed to `review_unit_evaluator`.

## Count semantics
- `sampleCount`: rows or slots that were eligible for the metric denominator.
- `missingCount`: data was absent without entering blocked or unavailable states.
- `falseCount`: denominator rows where the condition was explicitly false or the signal failed.
- `blockedCount`: evaluator blocker prevented the metric judgement.
- `unavailableCount`: evaluator reported the signal as unavailable.

## Status semantics
- `blocked` is used when no usable samples exist and blockers dominate the metric.
- `unavailable` is used when no usable samples exist and the metric cannot be judged.
- signal metrics use higher-is-better thresholds, except `fallbackRepetition`, which is lower-is-better.
- issue candidate rates stay read-only hints for PR-5 and do not write registry records.

## Future integration
- PR-5 should consume KPI envelopes and issue candidate rates for deterministic detection.
- PR-8 query/read layers should reuse KPI envelopes without changing this contract.
- PR-5 detector reuse keeps KPI envelopes read-only and performs registry/backlog writes only through an explicit wrapper usecase.

## Transcript coverage diagnostics
- operator/read-side surfaces may expose:
  - `transcriptWriteOutcomeCounts`
  - `transcriptWriteFailureReasons`
  - `snapshotInputDiagnostics`
  - `transcriptCoverageStatus`
- decay-aware readiness surfaces may expose:
  - `recentWindowStatus`
  - `historicalBacklogStatus`
  - `overallReadinessStatus`
  - `recentWindow`
  - `fullWindow`
  - `previousFullWindow`
  - `deltaFromPreviousFullWindow`
  - `historicalDebt`
  - `currentRuntimeHealth`
- `snapshotInputDiagnostics` may include:
  - `assistantReplyPresent`
  - `assistantReplyLength`
  - `sanitizedReplyLength`
  - `snapshotBuildAttempted`
  - `snapshotBuildSkippedReason`
- these diagnostics explain snapshot write-path coverage and stay separate from:
  - `userMessageAvailableRate`
  - `assistantReplyAvailableRate`
  - `reviewableTranscriptRate`
- decay-aware readiness keeps recent runtime health separate from full-window backlog debt:
  - recent healthy + full unhealthy => `historical_backlog_dominant`
  - recent unhealthy => `current_runtime_or_current_join_problem`
  - recent healthy + full improving => `observation_continue_backlog_decay`
  - recent healthy + full healthy => `readiness_candidate`
- transcript coverage diagnostics do not widen retention and do not persist raw transcript text.
