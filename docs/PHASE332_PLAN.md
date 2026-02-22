# PHASE332_PLAN

## 目的
`/api/phase5/ops/users-summary` に `snapshotMode=prefer|require` を追加し、phase5 users summary でも snapshot strict 読取制御を可能にする。

## スコープ
- `src/routes/phase5Ops.js`
- `src/usecases/phase5/getUsersSummaryFiltered.js`
- `tests/phase332/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase5 users summary route が `snapshotMode` クエリを受け付ける。
- 不正値は 400 (`invalid snapshotMode`) を返す。
- usecase から admin summary usecase に `snapshotMode` が透過される。
- `npm run test:docs` / `npm test` / `node --test tests/phase332/*.test.js` が通る。
