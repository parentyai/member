# RUNBOOK_RETENTION_APPLY

## 目的
Retention dry-run で検証済みの対象のみ、stg環境で限定的に apply する。

## 前提
- endpoint: `POST /internal/jobs/retention-apply`
- guard: `x-city-pack-job-token` 必須
- feature flag: `RETENTION_APPLY_ENABLED=1`
- env gate: `ENV_NAME in {stg,stage,staging}`
- 監査: `audit_logs.action=retention.apply.execute|blocked`

## 安全制約
- `deletable=NO` は削除禁止
- `recomputable=false` は削除禁止
- policy未定義は `422 retention_policy_undefined`

## 実行手順
1. dry-run結果確認（先行必須）
- `POST /internal/jobs/retention-dry-run`
2. apply実行
- body: `{"collections":[...],"cutoffIso":"...","limit":200,"maxDeletes":200,"dryRunTraceId":"...","cursor":{"events":"evt_0001"}}`
  - `dryRunTraceId` は直前の dry-run 実行 traceId を指定する
  - `maxDeletes` は1回の実行上限
  - `cursor` は段階実行（resume）に利用
3. 監査確認
- `traceId`, `deletedCount`, `sampleDeletedIds`

## 停止条件
- `retention.apply.blocked` が連続
- `deletedCount` が想定上限を超過
- policy未定義が検出

## ロールバック
- 即時停止: `RETENTION_APPLY_ENABLED=0`
- 実行停止: token rotation
- コード差戻し: PR revert
