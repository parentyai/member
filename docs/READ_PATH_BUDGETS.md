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

## current_baseline_phase372
- worst_case_docs_scan_max: 20000
- fallback_points_max: 17
- hotspots_count_max: 20
- note: Product-out 収束基準。phase372 以降はこの末尾基準をCI評価に採用。

## current_baseline_phase584
- worst_case_docs_scan_max: 16000
- fallback_points_max: 17
- hotspots_count_max: 16
- note: phase580-584 の収束基準。docs artifact 一括ゲートと fallbackOnEmpty 制御後の基準値。

## current_baseline_phase586
- worst_case_docs_scan_max: 13000
- fallback_points_max: 17
- hotspots_count_max: 13
- note: phase585-586 の bounded fallback 置換後基準。global listAll fallback の route呼び出しを削減。

## current_baseline_phase590
- worst_case_docs_scan_max: 0
- fallback_points_max: 17
- hotspots_count_max: 0
- note: phase587-590 の収束基準。phase4/phase5/phase2 read-path の listAll hotspot を除去。
