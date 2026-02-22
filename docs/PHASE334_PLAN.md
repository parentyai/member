# PHASE334_PLAN

## 目的
`/api/phase4/admin/users-summary` と `/api/phase4/admin/notifications-summary` のレスポンスに `dataSource/asOf/freshnessMinutes` を add-only 追加し、snapshot-first 読取の観測性を統一する。

## スコープ
- `src/routes/admin/opsOverview.js`
- `src/usecases/admin/getUserOperationalSummary.js`
- `src/usecases/admin/getNotificationOperationalSummary.js`
- `tests/phase334/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase4 summary 2系統が既存 `items` を維持したまま `dataSource/asOf/freshnessMinutes` を返す。
- usecase の既定戻り値（配列）は維持し、`includeMeta=true` 指定時のみ `{ items, meta }` を返す。
- `npm run test:docs` / `npm test` / `node --test tests/phase334/*.test.js` が通る。
