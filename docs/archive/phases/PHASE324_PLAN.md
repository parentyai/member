# PHASE324_PLAN

## 目的
`/api/phase5/ops/users-summary` の read path に bounded knobs（`limit`, `analyticsLimit`）を追加し、既存互換を維持したままユーザー要約の読み取り量を制御可能にする。

## スコープ
- `src/routes/phase5Ops.js`
- `src/usecases/phase5/getUsersSummaryFiltered.js`
- `tests/phase324/*`（新規）
- `tests/phase5/opsFilter.test.js`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase5 users summary route が `limit/analyticsLimit` の任意クエリを受け付ける。
- 既存クエリなし呼び出しの挙動は維持される。
- `getUsersSummaryFiltered` が `limit/analyticsLimit` を user operational summary へ透過する。
- `npm run test:docs` / `npm test` / `node --test tests/phase324/*.test.js tests/phase5/opsFilter.test.js` が通る。
