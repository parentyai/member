# Quality Patrol Job Runbook

## Scope
- CLI entrypoints:
  - `node tools/run_quality_patrol.js`
  - `node tools/run_quality_patrol_metrics.js`
  - `node tools/run_quality_patrol_detection.js`
  - `node tools/run_quality_patrol_planning.js`
- shared runner helper:
  - `tools/quality_patrol/lib.js`
- cycle runner:
  - `tools/quality_patrol/run_quality_patrol_cycle.js`
- scheduled workflow:
  - `.github/workflows/quality-patrol.yml`

## Job modes
- `latest`
- `top-risk`
- `newly-detected-improvements`
- `observation-blockers`
- `next-best-pr`

## Default behavior
- PR-10 remains CLI first, and PR-11 adds an hourly GitHub Actions caller that reuses the same CLI/read-side foundations.
- default mode is read-only.
- default audience is `operator`.
- default `traceLimit` follows `limit` up to 200 so the standard patrol window does not create artificial trace-hydration backlog.
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
- cycle artifacts:
  - `/tmp/quality_patrol_cycle_replay.json`
  - `/tmp/quality_patrol_cycle_metrics.json`
  - `/tmp/quality_patrol_cycle_latest.json`
  - `/tmp/quality_patrol_cycle_operator.json`
  - `/tmp/quality_patrol_cycle_human.json`
  - `/tmp/quality_patrol_cycle_verify.json`

Output path is controlled by `--output`. If omitted, the job writes to `/tmp`.

## Observation automation
- `npm run quality-patrol:cycle` runs the same fixed sequence every time:
  1. replay same traffic set
  2. metrics artifact
  3. latest artifact
  4. operator newly-detected-improvements artifact
  5. human newly-detected-improvements artifact
  6. post-merge/runtime-window verification artifact
- the cycle runner prints a compressed decision log:
  - `QUALITY PATROL STATUS`
  - `runtime`
  - `backlog`
  - `decision`
  - `prD`
- the scheduled workflow runs hourly and uploads `/tmp/quality_patrol_cycle_*.json`.
- the GitHub Actions caller preloads a Firebase Admin external-account bridge before `npm run quality-patrol:cycle`.
  - source auth remains OIDC/WIF via `google-github-actions/auth@v3`
  - the workflow keeps `GOOGLE_APPLICATION_CREDENTIALS` on the OIDC/WIF credential file and preloads a `NODE_OPTIONS=--require=...` bridge that teaches Firebase Admin to exchange `external_account` tokens through `google-auth-library`
  - if this bridge step fails, treat it as a CI auth/materialization fault before inspecting patrol logic
- automation stays read-only apart from replay writes that already travel through the normal webhook -> action-log -> snapshot path.
- review-unit extraction treats FAQ logs as trace-supplemental evidence only, so unrelated latest FAQ rows are not mixed into the default patrol backlog window.

## Canonical audit read paths
- for cycle pass/fail confirmation, read `/tmp/quality_patrol_cycle_verify.json` first:
  - `windowEndsAfterMerge`
  - `recentWrittenAtLeast5`
  - `currentRuntime.status`
  - `historicalDebt.status`
  - `backlogSeparationGate.decision`
  - `backlogSeparationGate.prDStatus`
- for artifact-level runtime/backlog interpretation, treat these as the canonical nested paths:
  - `backlogSeparation.currentRuntime.status` => current runtime truth
  - `backlogSeparation.historicalDebt.status` => historical backlog truth
  - `backlogSeparation.backlogSeparationGate.decision` / `prDStatus` => final separated gate for audits
  - `decayAwareOpsGate.decision` / `historicalBacklogStatus` / `overallReadinessStatus` / `prDStatus` => supporting operator explanation for why the gate resolved that way
- when transcript/join debt is cleared but only observation-only blocker residue remains, expect `backlogSeparationGate.decision=OBSERVATION_CONTINUE` rather than `NO_GO`.
- do not require top-level `currentRuntimeHealth.status`, `historicalBacklogStatus`, or `overallReadinessStatus` in cycle artifacts.
  - if they are absent, that is not a contract break.
  - read the nested `backlogSeparation.*` and `decayAwareOpsGate.*` paths above instead.

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
- automated cycle:
  - `npm run quality-patrol:cycle`

## Stop / rollback
- immediate stop:
  - stop running the CLI jobs
  - disable `.github/workflows/quality-patrol.yml`
  - do not pass `--write-issues` or `--write-backlog`
- staged rollback:
  - stop job callers first
  - keep the foundation contracts intact
- full rollback:
  - revert the automation PR that introduced `quality-patrol:cycle` and `.github/workflows/quality-patrol.yml`

## Non-goals in PR-10
- no admin UI contract change
- no query route shape change
- no runtime answer behavior change
- no automatic remediation
