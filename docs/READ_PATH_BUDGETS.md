# READ_PATH_BUDGETS

read path の増悪を CI で停止するための予算定義（add-only）。

## budgets
- worst_case_docs_scan_max: 62000
- fallback_points_max: 40

## policy
- 予算超過は CI fail（増悪のみ停止）。
- 予算以下への改善は pass。
- 予算更新は SSOT 追記 + 実行ログ必須。
