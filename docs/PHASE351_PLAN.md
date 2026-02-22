# PHASE351_PLAN

## 目的
Phase351 の add-only 補強を実施し、`/api/admin/os/dashboard/kpi` に fallbackMode 制御を追加する。

## スコープ
- `src/routes/admin/osDashboardKpi.js`
- `tests/phase351/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- `fallbackMode=allow|block` を受理し、無効値は 400 を返す。
- `fallbackMode=block` で `listAllUsers/listAllNotifications` を実行しない。
- `npm run test:docs` / `npm test` が通る。
