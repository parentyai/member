# PHASE354_PLAN

## 目的
Phase354 の add-only 補強を実施し、ops snapshot health を maintenance pane で可視化する。

## スコープ
- `src/routes/admin/opsSnapshotHealth.js`
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `tests/phase354/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- maintenance pane で snapshot health が read-only 表示される。
- `snapshotType` クエリが API で利用できる。
- `npm run test:docs` / `npm test` が通る。
