# 運用RUNBOOK（日本語）

更新日: 2026-02-14

## 1. 緊急停止（最優先）
- 画面: `/admin/ops` → Operations（安全操作）
- 手順: plan ON → confirmToken を確認 → set
- 結果: 送信が止まる（Kill Switch）

根拠:
- `/Users/parentyai.com/Projects/Member/apps/admin/ops_readonly.html:41-55`
- `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_ADMIN_OPS.md:85-97`

## 2. 調査（traceIdで追う）
- 画面: `/admin/ops` → Trace Search
- 手順: traceId を入力 → audits/decisions/timeline を確認

根拠:
- `/Users/parentyai.com/Projects/Member/apps/admin/ops_readonly.html:58-66`
- `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_TRACE_AUDIT.md:29-33`

## 3. 送れない/送られすぎの対応
- 送れない: Kill Switch が ON でないか確認 → planHash/confirmToken の不一致を疑う → Error Console で retry queue / WARN を確認
- 送られすぎ: Kill Switch を ON → System Config の notificationCaps を確認

根拠:
- `/Users/parentyai.com/Projects/Member/apps/admin/errors.html:25-58`
- `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_ADMIN_OPS.md:45-83`

## 4. 回復（再送しない回復）
- 目的: 二重送信を避けるため、詰まりを「封印」で回復
- 画面: `/admin/master` → Delivery Recovery（seal）
- 手順: status → plan → execute（confirmToken 必須）

根拠:
- `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_ADMIN_OPS.md:100-117`

## 5. ロールバック
- 直近の実装変更を revert
- 設定起因の場合は Environment Variables/Secrets を元に戻して再デプロイ

根拠:
- `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_DEPLOY_ENVIRONMENTS.md:139-140`

## 6. UI表示変更時の標準手順
1. 辞書更新（UI表示SSOT）
2. UI変更
3. `npm run test:docs`
4. PRテンプレのUIチェックを全て埋める
5. CI PASSを確認

根拠:
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md:1-176`
- `/Users/parentyai.com/Projects/Member/tools/verify_docs.js:96-204`
- `/Users/parentyai.com/Projects/Member/.github/PULL_REQUEST_TEMPLATE.md:12-14`
