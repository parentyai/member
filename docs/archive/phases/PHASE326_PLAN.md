# PHASE326_PLAN

## 目的
`/api/phase4/admin/users-summary` に bounded knobs（`limit`, `analyticsLimit`）を追加し、既存互換を維持したまま phase4 users summary の読み取り量を制御可能にする。

## スコープ
- `src/routes/admin/opsOverview.js`
- `src/usecases/admin/getUserOperationalSummary.js`
- `tests/phase326/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase4 users summary route が `limit/analyticsLimit` の任意クエリを受け付ける。
- `limit` 不正値は 400 (`invalid limit`) を返す。
- `getUserOperationalSummary` が `limit` を反映する。
- `npm run test:docs` / `npm test` / `node --test tests/phase326/*.test.js` が通る。
