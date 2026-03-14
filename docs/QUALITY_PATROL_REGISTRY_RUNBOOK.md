# QUALITY_PATROL_REGISTRY_RUNBOOK

Issue Registry / Improvement Backlog foundation for Member Quality Patrol v1.1 (add-only).

## Scope
- collections:
  - `quality_issue_registry`
  - `quality_improvement_backlog`
- write path:
  - `src/usecases/qualityPatrol/upsertQualityIssue.js`
  - `src/usecases/qualityPatrol/upsertImprovementBacklog.js`
- read helpers:
  - `src/usecases/qualityPatrol/listOpenIssues.js`
  - `src/usecases/qualityPatrol/listTopPriorityBacklog.js`
- no runtime webhook/orchestrator caller in PR-1

## quality_issue_registry
- purpose: normalized issue record with fingerprint-based dedupe
- id strategy: deterministic `issueId` derived from `issueFingerprint`
- stores:
  - `layer`, `category`, `slice`
  - `severity`, `status`, `provenance`, `observationBlocker`, `confidence`
  - `supportingEvidence`, `traceRefs`, `sourceCollections`, `relatedMetrics`
  - `firstSeenAt`, `lastSeenAt`, `occurrenceCount`, `latestSummary`

## quality_improvement_backlog
- purpose: improvement candidate registry linked from one or more issue ids
- stores:
  - `status`, `priority`, `issueIds`
  - `proposedPrName`, `objective`, `whyNow`
  - `targetFiles`, `expectedKpiMovement`, `risk`, `rollbackPlan`, `dependency`

## Dedupe / Severity / Status
- same `issueFingerprint` updates the same issue record instead of appending a new issue
- severity escalation is monotonic on repeated detections
- low-confidence or low-sample issues normalize to `watching`
- PR-1 does not auto-close issues

## Retention
- `quality_issue_registry`: `config / INDEFINITE / NO / recomputable=false`
- `quality_improvement_backlog`: `config / INDEFINITE / NO / recomputable=false`

## Rollback
- immediate stop: do not call the PR-1 usecases from runtime or jobs
- staged rollback: stop callers, then stop repo reads, then hide docs/read surfaces if any were added later
- full rollback: revert the PR that introduced `quality_issue_registry` and `quality_improvement_backlog`

## Non-goals In PR-1
- no transcript extraction
- no conversation evaluator
- no KPI builder
- no admin route / admin UI
- no scheduler
