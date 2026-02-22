# PHASE356_PLAN

## 目的
Phase356 の add-only 補強を実施し、fallbackMode 未指定時の運用デフォルトを環境変数で制御可能にする。

## スコープ
- `src/domain/readModel/fallbackPolicy.js`
- `src/routes/admin/osDashboardKpi.js`
- `src/routes/admin/opsOverview.js`
- `src/routes/phase5Ops.js`
- `src/routes/phase5State.js`
- `tests/phase356/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- `READ_PATH_FALLBACK_MODE_DEFAULT=allow|block` を未指定時の既定値として採用する。
- query で指定された `fallbackMode` が優先される。
- `npm run test:docs` / `npm test` が通る。
