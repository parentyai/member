# RUNBOOK_STRUCT_DRIFT_BACKFILL

## 目的
`scenario/scenarioKey` と `ops_state/ops_states` のドリフトを、`dry-run` → `apply` の順で安全に補正する。

## 前提
- endpoint: `POST /internal/jobs/struct-drift-backfill`
- guard: `x-city-pack-job-token` 必須
- 監査: `audit_logs.action=struct_drift.backfill.execute`

## 実行者
- 実行: 運用管理者
- 承認: 設計責任者

## 実行手順
1. dry-run
- `{"dryRun":true,"scanLimit":500,"traceId":"..."}`
2. 結果確認
- `scenarioDriftCandidates`
- `opsStateDriftCandidate`
- `hasMore`
- `nextResumeAfterUserId`
3. apply（必要時のみ）
- `{"apply":true,"scanLimit":500,"resumeAfterUserId":"...","traceId":"..."}`
4. 監査確認
- `traceId` で `audit_logs` を確認

## 停止条件
- `changedCount` が想定外に大きい
- `opsStateDriftCandidate=true` が継続し続ける
- 同一 `resumeAfterUserId` で同じ結果を繰り返す

## 再開条件
- 問題箇所の原因特定後、`resumeAfterUserId` を使って再開

## ロールバック
- ジョブ停止: token rotation
- 変更停止: `dryRun` のみ運用
- 全面戻し: PR revert
