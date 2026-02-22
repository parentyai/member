# PHASE355_PLAN

## 目的
Phase355 の add-only 補強を実施し、load risk budget ratchet に hotspot 件数上限を追加する。

## スコープ
- `scripts/generate_load_risk.js`
- `docs/READ_PATH_BUDGETS.md`
- `docs/REPO_AUDIT_INPUTS/load_risk.json`
- `tests/phase355/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- `hotspots_count_max` を末尾基準として評価できる。
- 増悪のみ fail の既存ポリシーを維持する。
- `npm run test:docs` / `npm test` が通る。
