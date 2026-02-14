# セキュリティモデル（日本語）

更新日: 2026-02-14

## 1. 何を守るか
- 会員番号の本人を特定しない
- 平文の会員ID（Redac）は保存しない
- 管理者操作は追跡番号（traceId）で後から確認できる

根拠:
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:9-39`
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/auditLogsRepo.js:11-31`

## 2. だれが何を担当するか（責任分界）
- アプリの責任: 平文の会員IDや秘密情報を保存しない、監査ログを残す
- インフラの責任: 退避・削除・保持の設定はGCP側で管理
- 法務の責任: 保持/削除の最終判断と記録

根拠:
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:104-115`

## 3. 管理者操作の保護
- `/admin/*` と `/api/admin/*` は ADMIN_OS_TOKEN で保護
- トークンが未設定の場合は失敗する（安全側）

根拠:
- `/Users/parentyai.com/Projects/Member/src/index.js:24-165`

## 4. LLMの扱い
- 提案は人間の判断補助のみ
- 自動実行はしない

根拠:
- `/Users/parentyai.com/Projects/Member/docs/SSOT_ADMIN_UI_OS.md:6-15`
- `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_OPS_ASSIST.md:13-15`

## 5. 未確認事項
- 法令適合の最終判断は別途記録が必要

根拠:
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:113-131`
