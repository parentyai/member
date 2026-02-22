# PHASE328_PLAN

## 目的
`/api/phase5/state/summary` に bounded knob（`analyticsLimit`）を追加し、既存互換を維持したまま state summary の読取量を制御可能にする。

## スコープ
- `src/routes/phase5State.js`
- `tests/phase328/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase5 state summary route が `analyticsLimit` の任意クエリを受け付ける。
- 不正値は 400 (`invalid limit`) を返す。
- `npm run test:docs` / `npm test` / `node --test tests/phase328/*.test.js` が通る。
