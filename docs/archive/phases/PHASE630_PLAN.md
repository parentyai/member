# PHASE630_PLAN

## Goal
stg E2E checklist 実行時の手入力依存（`segment_template_key` / `composer_notification_id`）を削減し、空入力時に active データを自動解決して実行できるようにする。

## Scope
- `tools/run_stg_notification_e2e_checklist.js` に auto-resolve ロジックを追加
  - segment template: active templates から自動選択
  - composer notification: active notifications から `send/plan` 可能な候補を自動選択
- `.github/workflows/stg-notification-e2e.yml` の2入力を optional 化
- `docs/RUNBOOK_STG_NOTIFICATION_E2E_CHECKLIST.md` を optional + auto-resolve 記述へ更新
- phase630 契約テストを追加

## Non-Goals
- 通知送信ロジック本体（plan/execute）の仕様変更
- Product Readiness 判定ロジックの変更
