# Quality Patrol Job Runbook

## Scope
- CLI entrypoints:
  - `node tools/run_quality_patrol.js`
  - `node tools/run_quality_patrol_metrics.js`
  - `node tools/run_quality_patrol_detection.js`
  - `node tools/run_quality_patrol_planning.js`
- shared runner helper:
  - `tools/quality_patrol/lib.js`

## Job modes
- `latest`
- `top-risk`
- `newly-detected-improvements`
- `observation-blockers`
- `next-best-pr`

## Default behavior
- PR-10 is CLI first. No external scheduler or new route is introduced here.
- default mode is read-only.
- default audience is `operator`.
- jobs reuse the existing read-side foundations:
  - review units
  - evaluator
  - KPI builder
  - detection engine
  - root cause analyzer
  - improvement planner
  - query serializer

## Write flags
- `--write-issues`
  - opt-in only
  - disabled by default
- `--write-backlog`
  - opt-in only
  - requires `--write-issues`
  - disabled by default

Write mode is allowed only after the read-only pipeline finishes and review units are available. If the pipeline is degraded or evidence is unavailable, the job skips writes and records the skip reason in the artifact.

## Output artifacts
- main artifact:
  - `summary`
  - `issues[]`
  - `observationBlockers[]`
  - `evidence[]`
  - `traceRefs[]`
  - `recommendedPr[]`
  - `audience`
  - `mode`
  - `generatedAt`
  - `planningStatus`
  - `analysisStatus`
  - `runtimeFetchStatus`
- metrics-only artifact
- detection-only artifact
- planning-only artifact

Output path is controlled by `--output`. If omitted, the job writes to `/tmp`.

## Degraded / unavailable semantics
- transcript unavailable
- fetch unavailable
- insufficient evidence
- observation gap

These states remain explicit in `runtimeFetchStatus`, `observationStatus`, `planningStatus`, and `analysisStatus`. The job does not collapse them into a generic failure.

## Manual operation
- latest snapshot:
  - `node tools/run_quality_patrol.js --mode latest --output /tmp/quality_patrol_latest.json`
- metrics snapshot:
  - `node tools/run_quality_patrol_metrics.js --output /tmp/quality_patrol_metrics.json`
- detection snapshot:
  - `node tools/run_quality_patrol_detection.js --output /tmp/quality_patrol_detection.json`
- planning snapshot:
  - `node tools/run_quality_patrol_planning.js --output /tmp/quality_patrol_planning.json`

## Stop / rollback
- immediate stop:
  - stop running the CLI jobs
  - do not pass `--write-issues` or `--write-backlog`
- staged rollback:
  - stop job callers first
  - keep the foundation contracts intact
- full rollback:
  - revert PR-10

## Non-goals in PR-10
- no external scheduler configuration
- no admin UI contract change
- no query route shape change
- no runtime answer behavior change
- no automatic remediation
