# STRUCTURE_BUDGETS

構造ドリフト（legacy repo / merge candidates / naming drift / unresolved dynamic deps）の増悪を CI で停止するための予算定義（add-only）。

## policy
- 予算超過は CI fail（増悪のみ停止）。
- 予算以下への改善は pass。
- 予算更新は SSOT 追記 + 実行ログ必須。

## current_baseline_phase628
- legacy_repos_max: 6
- merge_candidates_max: 6
- naming_drift_scenario_max: 9
- unresolved_dynamic_dep_max: 0
- active_legacy_repo_imports_max: 0
- structure_risk_freshness_max_hours: 24
- note: phase628 の収束基準。`design_ai_meta` 起点で算出した structure_risk の増悪を停止し、product-readiness で鮮度と予算超過を同時監視する。

## current_baseline_catchup_2026_02_25
- legacy_repos_max: 6
- merge_candidates_max: 6
- naming_drift_scenario_max: 9
- unresolved_dynamic_dep_max: 0
- active_legacy_repo_imports_max: 0
- structure_risk_freshness_max_hours: 24
- note: 4週間キャッチアップ期間の増悪停止基準。legacy/merge/naming drift の新規増加をブロックする。
