# PHASE325_PLAN

## 目的
`/api/phase5/ops/member-number-stale` の read path に bounded knob（`limit`）を追加し、既存互換を維持したまま stale member 集計の読み取り量を制御可能にする。

## スコープ
- `src/routes/phase5Ops.js`
- `tests/phase325/*`（新規）
- `docs/SSOT_INDEX.md`

## 受入条件
- phase5 member stale route が `limit` の任意クエリを受け付ける。
- 既存クエリなし呼び出しの挙動は維持される。
- `limit` 不正値は 400 (`invalid limit`) を返す。
- `npm run test:docs` / `npm test` / `node --test tests/phase325/*.test.js` が通る。
