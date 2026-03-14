# Quality Patrol Query Runbook

## Scope
- route: `GET /api/admin/quality-patrol`
- route handler: `src/routes/admin/qualityPatrol.js`
- usecase wrapper: `src/usecases/qualityPatrol/queryLatestPatrolInsights.js`
- serializers:
  - `src/domain/qualityPatrol/query/buildPatrolQueryResponse.js`
  - `src/domain/qualityPatrol/query/serializePatrolSummary.js`
  - `src/domain/qualityPatrol/query/serializePatrolIssues.js`
  - `src/domain/qualityPatrol/query/serializePatrolEvidence.js`
  - `src/domain/qualityPatrol/query/serializePatrolRecommendedPr.js`
  - `src/domain/qualityPatrol/query/serializePatrolObservationBlockers.js`

## Contract
- query is read-only. PR-8 does not write issue registry, backlog, snapshots, or scheduler artifacts.
- audience split is explicit:
  - `operator`: richer evidence, trace refs, provenance, and proposal context
  - `human`: compact summary, reduced internal metadata, no raw trace ids
- blocked, missing, unavailable, and insufficient evidence are preserved in the response. Query does not collapse them into a generic failure.
- blocker-first rule applies. If observation blockers dominate, blockers appear before runtime-fix recommendations.

## Supported modes
- `latest`: current read-side synthesis over review units, evaluations, KPIs, issues, root causes, and proposals
- `top-risk`: prioritize highest-severity issues and proposals
- `newly-detected-improvements`: emphasize newly detected issues/proposals, capped to a small set
- `observation-blockers`: focus on blocker and coverage gaps
- `next-best-pr`: return the top proposal candidates in deterministic priority order

## Response shape
- `queryVersion = quality_patrol_query_v1`
- `summary` includes `overallStatus`, `topFindings`, `topPriorityCount`, `observationBlockerCount`
- `issues[]` includes query-facing severity/status/category summaries
- `observationBlockers[]` keeps blocker title, slices, and recommended action
- `evidence[]` includes read-only metric/signal/trace/snapshot/summary references
- `traceRefs[]` may be returned for operator audience only
- `recommendedPr[]` includes proposal priority, objective, risk, and blockers
- `observationStatus` remains `ready`, `blocked`, `insufficient_evidence`, or `unavailable`

## Security and privacy
- route is under `/api/admin/*` and therefore inherits admin token protection from the protection matrix.
- route also requires `x-actor` like other admin endpoints.
- raw transcript is not returned. Trace references are identifiers only and human audience suppresses direct trace ids.

## Admin UI surface
- PR-9 adds the read-only `Quality Patrol` pane inside `/admin/app`.
- default UI state is `mode=latest` and `audience=operator`.
- UI keeps the blocker-first rule: `observationBlockers[]` render before `recommendedPr[]`.
- operator view shows denser evidence and trace handoff buttons; human view keeps the summary compact and suppresses direct trace refs.
- scheduler is not wired yet. `latest` remains live synthesis from the read-side foundations.

## Non-goals in PR-8
- no admin UI pane
- no scheduler or cron caller
- no registry/backlog persistence change
- no runtime conversation behavior change

## Future integration
- admin UI can consume this route without redefining the response shape.
- scheduler can reuse the usecase output for snapshot-style reporting later.
- query continues to rely on read-side synthesis until a scheduled patrol artifact is introduced.

## PR-10 job integration
- PR-10 introduces CLI-first patrol jobs that reuse the same query contract for artifact output.
- jobs remain read-only by default and do not change route semantics.
- external scheduler wiring is still not part of the contract; `/tmp` or explicit output paths are used until cron/internal orchestration is added.
