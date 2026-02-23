# RETENTION_BUDGETS

retention 未定義の増悪を CI で停止するための予算定義（add-only）。

## policy
- 予算超過は CI fail（増悪のみ停止）。
- 予算以下への改善は pass。
- 予算更新は SSOT 追記 + 実行ログ必須。

## current_baseline_phase625
- undefined_retention_max: 45
- undefined_deletable_conditional_max: 11
- undefined_recomputable_max: 11
- note: retention policy 数値未確定の間は増悪停止のみを行う。法務/事業の決定後に段階的に縮小する。
