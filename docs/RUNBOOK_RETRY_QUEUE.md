# RUNBOOK_RETRY_QUEUE

## Purpose
送信失敗（retry queue）を手動で再送し、結果を監査できる一本道を固定する。

## Steps
1. Segment Send（Phase67/81/68）で plan/dry-run/execute を実行する（confirmToken 必須）。
2. failures が出た場合、Retry Queue を開く。
3. Retry Queue の PENDING を plan する:
   - `POST /api/phase73/retry-queue/plan` `{ queueId }`
4. confirmToken を持った状態で retry を実行する:
   - `POST /api/phase73/retry-queue/retry` `{ queueId, planHash, confirmToken }`
5. 成功したものは DONE になる。失敗は PENDING のまま lastError を確認する。

## Notes
- kill switch ON のとき retry は拒否される。
- planHash/confirmToken mismatch は 409 を返すため、再度 plan する。
- ServicePhase/NotificationPreset が設定済みの場合、`notificationCategory` が許可範囲外だと retry は `notification_policy_blocked` で拒否される。

## Rollback
- enqueue された retry queue は append-only（削除しない）。
- 実装PRを revert する。
