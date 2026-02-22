# Phase595: Product Readiness Freshness Governance

## 目的
- `/api/admin/product-readiness` の最新性監査を実運用化するため、`load_risk` / `missing_index_surface` の更新鮮度閾値を read-path バジェットに明示する。

## 非対象
- read-path 計算ロジック自体の変更
- 既存ガード判定のしきい値（fallback/hotspot）は変更しない

## 受け入れ条件
- `docs/READ_PATH_BUDGETS.md` の最新 baseline に freshness key を追加済み
- `npm run load-risk:check` / `npm run missing-index-surface:check` の生成物整合を維持
- README系ドキュメント整合テスト（新規）を追加し、`freshness` 未定義を検出
- `npm run test:docs` / `npm test` を通過

## 変更点
- `docs/READ_PATH_BUDGETS.md`:
  - `current_baseline_phase594` に以下を追加
    - `load_risk_freshness_max_hours`
    - `missing_index_surface_freshness_max_hours`
- `tests/phase595/*`:
  - budget freshness キー存在チェック
  - product-readiness の freshness 参照契約チェック
- 生成物は既存生成フロー（generate/check）で整合。
