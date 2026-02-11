# RUNBOOK_STG_NOTIFICATION_E2E_CHECKLIST

stg 実測を毎回同じ順番で実施し、traceId で証跡化するための固定チェックリスト。

## Preconditions
- `gcloud auth login` 済み
- `member-485303 / us-east1` へのアクセス権
- Admin token が取得できること（Secret Manager 管理）

## Checklist (fixed order)
1. Segment Send: `plan -> dry-run -> execute`
2. Retry Queue: `plan -> retry`
3. Kill Switch: ON時に send 系が全ブロックされる
4. Composer execute: cap 到達ユーザーが `notification_cap_blocked`

## Evidence Capture
- 各操作で `x-trace-id` を固定して送る
- `GET /api/admin/trace?traceId=<id>&limit=50` で bundle を回収
- `docs/PHASE170_EXECUTION_LOG.md` へ以下を追記:
  - traceId
  - requestId
  - expected
  - actual
  - pass/fail

## Acceptance
- `audits/decisions/timeline` が欠損しない
- ブロック理由が `notification_policy_blocked` または `notification_cap_blocked` で一貫
- 個人情報（平文ID）は証跡に残さない
