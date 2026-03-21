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
- decay-aware ops gate surfaces may expose:
  - `decision` (`GO` / `NO_GO` / `OBSERVATION_CONTINUE`)
  - `decisionReasonCode`
  - `operatorAction`
  - `prDEligible`
  - `prDStatus`
  - `prDReasonCode`
- add-only backlog separation surfaces may expose:
  - `backlogSeparation.currentRuntime`
  - `backlogSeparation.historicalDebt`
  - `backlogSeparation.backlogSeparationGate`
- backlog separation is read-side only and exists to prevent current runtime health from being collapsed into historical full-window debt.
- human audience keeps these top-level KPI-derived objects but compresses them:
  - `transcriptCoverage`: counts + coverage summary only
  - `decayAwareReadiness`: recent/full summary without raw debt keys or internal readiness taxonomy
  - `decayAwareOpsGate`: `decision`, human-readable `operatorAction`, `prDStatus`
- canonical audit reading order is:
  - `backlogSeparation.currentRuntime.status` first for current runtime health
  - `backlogSeparation.historicalDebt.status` first for historical backlog state
  - `backlogSeparation.backlogSeparationGate.decision` / `prDStatus` for the separated final gate
  - `decayAwareOpsGate.historicalBacklogStatus` / `overallReadinessStatus` as supporting explanation
- `currentRuntimeHealth.status`, top-level `historicalBacklogStatus`, and top-level `overallReadinessStatus` remain supporting readiness fields when they are present, but they are not the primary audit lookup path once `backlogSeparation` exists.
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
  - recent healthy + transcript/join debt cleared but observation-only blocker residue remains => `observation_continue_backlog_decay`
  - recent healthy + full healthy => `readiness_candidate`
- decay-aware ops gate maps those statuses into operator actions:
  - `current_runtime_or_current_join_problem` => `NO_GO`, repair current runtime or current join path first
  - `historical_backlog_dominant` => `NO_GO`, treat the gap as historical debt and keep PR-D deferred
  - `observation_continue_backlog_decay` => `OBSERVATION_CONTINUE`
  - `readiness_candidate` => `GO`
- backlog separation gate must keep the same rule ordering:
  - current runtime unhealthy => runtime repair stays first
  - current runtime healthy + historical debt stagnating => `NO_GO`
  - current runtime healthy + historical debt decaying => `OBSERVATION_CONTINUE`
  - current runtime healthy + historical debt cleared => `GO`
- PR-D is allowed only when:
  - `backlogSeparation.currentRuntime.status = healthy`
  - `backlogSeparation.historicalDebt.status = cleared`
  - `backlogSeparation.backlogSeparationGate.decision = GO`
  - `decayAwareOpsGate.prDStatus = eligible`
- transcript coverage diagnostics do not widen retention and do not persist raw transcript text.

## Post-merge reproducibility
- post-merge quality patrol verification uses repo-local replay tooling instead of external `/tmp/*.js` harnesses.
- replay harness path: `tools/quality_patrol/replay_same_traffic_set.js`
- verification harness path: `tools/quality_patrol/verify_postmerge_runtime_window.js`
- observation automation path: `tools/quality_patrol/run_quality_patrol_cycle.js`
- replay result artifact defaults to `/tmp/quality_patrol_replay_result.json`
- verification artifact defaults to `/tmp/quality_patrol_postmerge_verify.json`
- automated cycle artifacts default to:
  - `/tmp/quality_patrol_cycle_replay.json`
  - `/tmp/quality_patrol_cycle_metrics.json`
  - `/tmp/quality_patrol_cycle_latest.json`
  - `/tmp/quality_patrol_cycle_operator.json`
  - `/tmp/quality_patrol_cycle_human.json`
  - `/tmp/quality_patrol_cycle_verify.json`
- KPI rerun stays read-only and uses the existing patrol jobs:
  - `node tools/run_quality_patrol_metrics.js --output /tmp/quality_patrol_metrics_postmerge_verify.json`
  - `node tools/run_quality_patrol.js --mode latest --output /tmp/quality_patrol_latest_postmerge_verify.json`
- scheduled automation reuses the same jobs hourly via `.github/workflows/quality-patrol.yml`.
- replay verification is successful only when:
  - `currentRuntime.window.toAt > mergedAt`
  - `recentWindow.written >= 5`
  - `currentRuntime.status = healthy`
  - `historicalDebt.status` remains separated from current runtime facts
