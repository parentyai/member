# PHASE335_PLAN

## 目的
`/api/admin/monitor-insights` に `snapshotMode=prefer|require` を追加し、`require` 時に full-scan fallback を抑止できるようにする。

## スコープ
- `src/routes/admin/monitorInsights.js`
- `tests/phase335/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- monitor insights route が `snapshotMode` を受け付ける。
- 不正値は 400 (`invalid snapshotMode`)。
- `snapshotMode=require` かつ range結果ゼロ時は fallback せず `note=NOT AVAILABLE` を返す。
- `npm run test:docs` / `npm test` / `node --test tests/phase335/*.test.js` が通る。
