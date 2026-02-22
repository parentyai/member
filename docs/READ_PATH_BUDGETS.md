# READ_PATH_BUDGETS

read path の増悪を CI で停止するための予算定義（add-only）。

## budgets
- worst_case_docs_scan_max: 62000
- fallback_points_max: 40

## policy
- 予算超過は CI fail（増悪のみ停止）。
- 予算以下への改善は pass。
- 予算更新は SSOT 追記 + 実行ログ必須。

## current_baseline_phase350
- worst_case_docs_scan_max: 23000
- fallback_points_max: 22
- note: 既存 `budgets` は履歴値として保持し、CI評価はこの末尾値を採用する。

## current_baseline_phase355
- worst_case_docs_scan_max: 23000
- fallback_points_max: 22
- hotspots_count_max: 23
- note: hotspot件数の増悪を停止する ratchet を追加（同等/改善は pass）。

## current_baseline_phase362
- worst_case_docs_scan_max: 23000
- fallback_points_max: 22
- hotspots_count_max: 23
- note: 収束パッケージ後の最新基準。以後はこの末尾基準をCI評価に採用。
