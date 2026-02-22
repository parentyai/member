# PHASE329_PLAN

## 目的
`/api/phase4/admin/users-summary` と `/api/phase5/state/summary` に snapshot mode knob（`snapshotMode=prefer|require`）を追加し、既存互換を維持したまま snapshot strict 読取制御を可能にする。

## スコープ
- `src/routes/admin/opsOverview.js`
- `src/routes/phase5State.js`
- `tests/phase329/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- 上記2 route が `snapshotMode` の任意クエリを受け付ける。
- 不正値は 400 (`invalid snapshotMode`) を返す。
- `snapshotMode=require` 指定時の既存 usecase 契約（summary=[] / state notAvailable）が維持される。
- `npm run test:docs` / `npm test` / `node --test tests/phase329/*.test.js` が通る。
