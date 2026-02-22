# PHASE331_PLAN

## 目的
`/api/phase5/ops/notifications-summary` に `snapshotMode=prefer|require` を追加し、phase5 notifications summary でも snapshot strict 読取を可能にする。

## スコープ
- `src/routes/phase5Ops.js`
- `src/usecases/phase5/getNotificationsSummaryFiltered.js`
- `tests/phase331/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase5 notifications summary route が `snapshotMode` クエリを受け付ける。
- 不正値は 400 (`invalid snapshotMode`) を返す。
- `snapshotMode=require` かつ snapshot 未存在時は空配列を返す。
- `npm run test:docs` / `npm test` / `node --test tests/phase331/*.test.js` が通る。
