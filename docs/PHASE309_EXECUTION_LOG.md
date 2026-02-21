# PHASE309_EXECUTION_LOG

## 実施内容
- Struct Drift Backfill:
  - `runStructDriftBackfill` usecase を追加
  - admin runs/list + execute route を追加
  - `/admin/app` の証跡ペインに実行UIを追加
- Admin導線:
  - `/admin/review` に LEGACY バナーを追加
- Trace Bundle:
  - traceId 系 query を `where + orderBy + limit` の index前提へ
- Snapshot:
  - `ops_read_model_snapshots` repo/usecase/internal job を追加
  - dashboard KPI と summary usecase を snapshot優先化
- Retention Apply:
  - `/internal/jobs/retention-apply` を追加（stg限定/flag必須/policy制約）

## 監査
- backfill: `struct_drift.backfill.execute`
- retention apply: `retention.apply.execute|blocked`
- snapshot: `ops_snapshot.build.execute|dry_run`

## ロールバック
1. feature flag OFF (`RETENTION_APPLY_ENABLED=0`, `OPS_SNAPSHOT_READ_ENABLED=0`)
2. internal token rotation
3. PR revert
