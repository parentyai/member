# Phase595: Product Readiness Freshness Governance

## 実行メモ
- `docs/READ_PATH_BUDGETS.md`
  - latest baseline (`current_baseline_phase594`) に freshness key を追加
  - `load_risk_freshness_max_hours: 24`
  - `missing_index_surface_freshness_max_hours: 24`
- tests:
  - `tests/phase595/phase595_t01_read_path_budget_freshness_contract.test.js`
  - `tests/phase595/phase595_t02_product_readiness_freshness_contract.test.js`
- docs artifacts:
  - `npm run load-risk:generate`
  - `npm run missing-index-surface:generate`

## 実行コマンド
- `git status -sb`
- `npm run test:docs`
- `npm run load-risk:generate`
- `npm run missing-index-surface:generate`
- `npm run load-risk:check`
- `npm run missing-index-surface:check`
- `node --test tests/phase595/*.test.js`
