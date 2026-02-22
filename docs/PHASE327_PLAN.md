# PHASE327_PLAN

## 目的
`/api/phase4/admin/notifications-summary` に bounded knob（`eventsLimit`）を追加し、既存互換を維持したまま phase4 notifications summary のイベント読み取り量を制御可能にする。

## スコープ
- `src/routes/admin/opsOverview.js`
- `tests/phase327/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase4 notifications summary route が `eventsLimit` の任意クエリを受け付ける。
- `limit/eventsLimit` 不正値は 400 (`invalid limit`) を返す。
- `getNotificationOperationalSummary` へ `eventsLimit` が透過される。
- `npm run test:docs` / `npm test` / `node --test tests/phase327/*.test.js` が通る。
