# PHASE576_PLAN

## 目的
管理UIに nationwide composition と fallback/readiness の read-only 可視化を追加する。

## スコープ
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `tests/phase576/*`

## 受入条件
- city-pack pane に composition セクションが追加される。
- read-only で readiness/fallback サマリーが表示される。
- `npm run test:docs` / `npm test` が通る。
