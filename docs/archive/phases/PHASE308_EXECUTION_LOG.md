# PHASE308_EXECUTION_LOG

## Summary
- Phase307 後の残課題（legacy import 残存・fallback hook 未適用・retention coverage不足）を add-only で補強。

## Commands
- `rg -n "phase2ReadRepo|phase2ReportsRepo|phase2RunsRepo|phase18StatsRepo|phase22KpiSnapshotsRepo|phase22KpiSnapshotsReadRepo" src/routes src/usecases scripts tests -S`
- `python3 - <<'PY' ... isMissingIndexError vs hook coverage ... PY`
- `node --test tests/phase308/*.test.js`
- `npm run test:docs`
- `npm test`

## Verification Result
- `node --test tests/phase308/*.test.js` PASS（4 tests）
- `npm run test:docs` PASS（`[docs] OK`）
- `npm test` PASS（893 tests / 0 fail）

## Key Diffs
- legacy import cleanup:
  - `src/routes/admin/osDashboardKpi.js`
  - `scripts/phase22_run_gate_and_record.js`
  - `scripts/phase22_list_kpi_snapshots.js`
- fallback hook completion:
  - `src/repos/firestore/*` の missing-index fallback catch を補完
- retention policy expansion:
  - `src/domain/retention/retentionPolicy.js`
  - `src/routes/internal/retentionDryRunJob.js`
- forced convergence:
  - `src/repos/firestore/indexFallbackPolicy.js`（stg/prod fail-closed default）
  - `src/usecases/admin/getUserOperationalSummary.js`（bounded query）
  - `src/usecases/phase5/getUserStateSummary.js`（bounded query）
  - `src/routes/admin/osDashboardKpi.js`（bounded query）
  - `src/routes/internal/retentionDryRunJob.js`（undefined policy fail-closed）
- drift backfill dry-run/apply job:
  - `src/routes/internal/structDriftBackfillJob.js`
  - `src/index.js` route wiring
- regression guards:
  - `tests/phase308/*`

## Notes
- CI evidence は merge 後 run id を `docs/CI_EVIDENCE/` に保存する。
