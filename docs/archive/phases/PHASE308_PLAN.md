# PHASE308_PLAN

## Objective
- 既存挙動を変えずに、構造補強を add-only で実施する。
- 対象: legacy import 凍結の徹底 / missing-index fallback 計測補完 / 構造ドリフト backfill job（internal） / retention policy 定義拡張 / dashboard hotspot の canonical read 化。
- 強制収束（追加）:
  - stg/prod で missing-index fail-closed を既定化
  - analytics listAll hotspot 上位3箇所を bounded query 化
  - retention policy 未定義 collection を dry-run で fail-closed

## Scope
- `src/routes/admin/osDashboardKpi.js`
- `scripts/phase22_run_gate_and_record.js`
- `scripts/phase22_list_kpi_snapshots.js`
- `src/repos/firestore/*`（missing-index fallback hook 補完）
- `src/routes/internal/structDriftBackfillJob.js`（新規）
- `src/domain/retention/retentionPolicy.js`（新規）
- `src/routes/internal/retentionDryRunJob.js`
- `src/index.js`
- `tests/phase308/*`（新規）

## Non-Goals
- 既存 API の破壊的変更
- delete 実行を伴う retention 処理
- legacy repo ファイル削除

## Acceptance
- `npm test` PASS
- `npm run test:docs` PASS
- 追加した repo fallback hook で `recordMissingIndexFallback` + `shouldFailOnMissingIndex` が揃う
- `/internal/jobs/struct-drift-backfill` が dry-run/apply で契約どおり動作する
