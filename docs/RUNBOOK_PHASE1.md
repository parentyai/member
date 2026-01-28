# Runbook Phase1

Linked Task: P1-006

## Deploy
- 既存CI/CDを利用（変更しない）
- member / member-webhook の公開範囲は維持

## Rollback
- GitHub: revert merge commit
- Cloud Run: 直前リビジョンに戻す

## Verification
- member (private): unauth 403 を維持
- member-webhook (public): /healthz 200
- Phase1 E2E: docs/PLAYBOOK_PHASE1_E2E.md を実施

## Ops Notes
- events は best-effort（失敗しても主処理は止めない）
- 次通知は管理画面で手動作成（自動選択なし）
- notification_deliveries は送信事実のみを記録する
