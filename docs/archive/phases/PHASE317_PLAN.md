# PHASE317_PLAN

## 目的
`getNotificationOperationalSummary` の events 読み取りを bounded range query 優先へ収束し、top hotspot の full-scan 依存を縮小する。

## スコープ
- `src/usecases/admin/getNotificationOperationalSummary.js`
- `tests/phase317/*`（新規）

## 受入条件
- summary 算出で `listEventsByCreatedAtRange` を優先利用する。
- bounded query が0件の場合は既存互換の `listAllEvents` へフォールバックする。
- 既存 API 応答契約（`{ ok, items }` / item key）を維持する。
- `npm run test:docs` / `npm test` / `node --test tests/phase317/*.test.js` が通る。
