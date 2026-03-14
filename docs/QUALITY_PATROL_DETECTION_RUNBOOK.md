# Quality Patrol Detection Runbook

## Scope
- detector entrypoint: `src/domain/qualityPatrol/detectIssues.js`
- write-enabled wrapper: `src/usecases/qualityPatrol/detectAndUpsertQualityIssues.js`
- detector is deterministic only; no LLM judge is used in PR-5.

## Inputs
- PR-4 KPI envelopes from `buildPatrolKpis`
- PR-1 issue/backlog foundations for optional persistence

## Core rules
- `blocked` and `unavailable` metrics become `observation_blocker` issues, not fail-quality issues.
- `missing`-heavy coverage metrics stay coverage/watch issues unless explicit blocker rules fire.
- `warn` metrics become `watching`.
- `fail` metrics become `open`.
- detector emits both `global` and slice-specific issues when evidence differs.

## Persistence
- `detectIssues` is read-only.
- `detectAndUpsertQualityIssues` writes only when `persist === true`.
- wrapper reuses `upsertQualityIssue` and `upsertImprovementBacklog`.
- blocker-style detection issues are persisted through the existing registry foundation as `watching + observationBlocker=true`.

## Non-goals in PR-5
- no root cause analysis
- no improvement planner
- no admin route or UI
- no scheduler or runtime caller wiring

## Future integration
- PR-6 should consume persisted detection issues for root cause analysis.
- PR-7 should expand minimal backlog hints into implementation-ready improvement plans.
