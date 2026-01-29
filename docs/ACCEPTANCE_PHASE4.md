# Acceptance Phase4 (Prepare Only)

## A. Phase4 PREPARE Ready
- Given: Phase3 は CLOSE されている
- When: Phase4 の準備用 SSOT が作成される
- Then: Phase4 開始前の前提が文書化されている
- Evidence: docs/SSOT_PHASE4.md

## B. Carryover Listed
- Given: Phase3 の持ち越し事項が存在する
- When: Phase4 の SSOT に一覧化する
- Then: 未決定事項が明示されている
- Evidence: docs/SSOT_PHASE4.md

## C. Human Decisions Listed
- Given: Phase4 開始に人間判断が必要
- When: チェックリストとして列挙する
- Then: 判断項目が明記されている
- Evidence: docs/SSOT_PHASE4.md

## D. Admin Read-only Aggregation
- Given: notifications と notification_deliveries が存在する
- When: Admin が READ ONLY 集計一覧を閲覧する
- Then: delivered/read/click の件数が返る
- Evidence: PR / adminReadModel.test.js

## E. Admin Operational Overview (Read-only)
- Given: users / notifications / events が存在する
- When: Admin が READ ONLY の運用判断支援ビューを閲覧する
- Then: ユーザー状態一覧と通知反応一覧が取得できる
- Evidence: PR / adminOpsSummary.test.js

## Evidence Log
| Area | Date (YYYY-MM-DD) | Executor | Evidence | Notes |
| --- | --- | --- | --- | --- |
| A. Phase4 PREPARE Ready | 未記録 | 未記録 | docs/SSOT_PHASE4.md | 未記録 |
| B. Carryover Listed | 未記録 | 未記録 | docs/SSOT_PHASE4.md | 未記録 |
| C. Human Decisions Listed | 未記録 | 未記録 | docs/SSOT_PHASE4.md | 未記録 |
| D. Admin Read-only Aggregation | 未記録 | 未記録 | PR / adminReadModel.test.js | 未記録 |
| E. Admin Operational Overview (Read-only) | 未記録 | 未記録 | PR #65 / adminOpsSummary.test.js (PASS) | Admin READ ONLY 運用判断支援ビュー（ユーザー状態 / 通知反応の一覧、書き込み・自動判断なし） |
