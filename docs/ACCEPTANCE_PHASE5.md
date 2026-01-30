# Acceptance Phase5 (Bootstrap)

## A. SSOT Created
- Given: Phase5 を開始する
- When: SSOT_PHASE5.md を作成する
- Then: Phase5 の目的 / 非目的 / 実装順序が明記されている
- Evidence: docs/SSOT_PHASE5.md

## B. TODO Created
- Given: Phase5 のタスクが必要
- When: TODO_PHASE5.md を作成する
- Then: P5-001 〜 P5-104 が Backlog / In Progress に整理されている
- Evidence: docs/TODO_PHASE5.md

## C. Guardrails Created
- Given: Phase5 の逸脱防止が必要
- When: GUARDRAILS_PHASE5.md を作成する
- Then: 禁止事項が明文化されている
- Evidence: docs/GUARDRAILS_PHASE5.md

## D. P5-101 Read-only State Visibility
- Given: 既存データが存在する
- When: READ ONLY の状態可視化を参照する
- Then: checklist 完了率 / memberNumber 有無が確認できる
- Evidence: PR / tests/phase5/stateSummary.test.js

## E. P5-102 Ops Read-only Filters
- Given: 既存データが存在する
- When: Ops 向け READ ONLY フィルタを参照する
- Then: 期間フィルタに応じて閲覧対象が絞り込まれる
- Evidence: PR / tests/phase5/opsFilter.test.js

## F. P5-104 Ops Manual Review Evidence
- Given: 運用者が手動でレビュー情報を記録する
- When: Admin READ ONLY で Last reviewed を参照する
- Then: lastReviewedAt / lastReviewedBy が表示される
- Evidence: PR / tests/phase5/opsReview.test.js

## G. P5-105 Ops Attention Summary
- Given: Ops user summary が参照できる
- When: Needs attention を確認する
- Then: memberNumber未入力 / checklist未完了 / stale のいずれかで Yes が表示される
- Evidence: PR / tests/phase5/opsAttention.test.js

## H. P5-106 Ops Review Evidence Write
- Given: Ops でレビュー操作を行う
- When: Reviewed を押下する
- Then: opsReviewLastReviewedAt / opsReviewLastReviewedBy が更新される
- Evidence: PR / tests/phase5/opsReviewWrite.test.js

## I. P5-107 Ops User List Filters
- Given: Ops user summary が参照できる
- When: needsAttention / stale / unreviewed / reviewAgeDays で絞り込む
- Then: 条件に一致するユーザーのみ表示される
- Evidence: PR / tests/phase5/opsFilters.test.js

## Evidence Log
| Area | Date (YYYY-MM-DD) | Executor | Evidence | Notes |
| --- | --- | --- | --- | --- |
| A. SSOT Created | 未記録 | 未記録 | docs/SSOT_PHASE5.md | 未記録 |
| B. TODO Created | 未記録 | 未記録 | docs/TODO_PHASE5.md | 未記録 |
| C. Guardrails Created | 未記録 | 未記録 | docs/GUARDRAILS_PHASE5.md | 未記録 |
| D. P5-101 Read-only State Visibility | 未記録 | 未記録 | PR #71 / tests/phase5/stateSummary.test.js (PASS) | 未記録 |
| E. P5-102 Ops Read-only Filters | 未記録 | 未記録 | PR #73 / tests/phase5/opsFilter.test.js (PASS) | 未記録 |
| F. P5-104 Ops Manual Review Evidence | 未記録 | 未記録 | PR #76 / tests/phase5/opsReview.test.js (PASS) | 未記録 |
| G. P5-105 Ops Attention Summary | 未記録 | 未記録 | PR #79 / tests/phase5/opsAttention.test.js (PASS) | 未記録 |
| H. P5-106 Ops Review Evidence Write | 未記録 | 未記録 | PR #81 / tests/phase5/opsReviewWrite.test.js (PASS) | 未記録 |
| I. P5-107 Ops User List Filters | 未記録 | 未記録 | PR #83 / tests/phase5/opsFilters.test.js (PASS) | 未記録 |
