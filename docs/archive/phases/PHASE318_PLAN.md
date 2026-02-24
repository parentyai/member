# PHASE318_PLAN

## 目的
`osDashboardKpi` の users/notifications 読み取りを bounded range query 優先に収束し、full-scan 常用経路をさらに縮小する。

## スコープ
- `src/repos/firestore/analyticsReadRepo.js`
- `src/routes/admin/osDashboardKpi.js`
- `docs/INDEX_REQUIREMENTS.md`
- `tests/phase318/*`（新規）

## 受入条件
- `analyticsReadRepo` に users/notifications の createdAt range query が追加される。
- `osDashboardKpi` が users/notifications を range query 優先で読み、0件時のみ既存 listAll fallback を使う。
- 既存 API 互換（レスポンス契約）を維持する。
- `npm run test:docs` / `npm test` / `node --test tests/phase318/*.test.js` が通る。
