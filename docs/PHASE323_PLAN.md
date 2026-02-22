# PHASE323_PLAN

## 目的
`/api/phase5/ops/notifications-summary` の read path に bounded knobs（`limit`, `eventsLimit`）を追加し、既存互換を維持したまま負荷制御を可能にする。

## スコープ
- `src/routes/phase5Ops.js`
- `src/usecases/phase5/getNotificationsSummaryFiltered.js`
- `tests/phase323/*`（新規）
- `tests/phase5/opsFilter.test.js`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase5 notifications summary route が `limit/eventsLimit` の任意クエリを受け付ける。
- 既存クエリなし呼び出しの挙動は維持される。
- `getNotificationsSummaryFiltered` が `limit/eventsLimit` を operational summary へ透過する。
- `npm run test:docs` / `npm test` / `node --test tests/phase323/*.test.js tests/phase5/opsFilter.test.js` が通る。
