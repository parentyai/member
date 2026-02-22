# PHASE330_PLAN

## 目的
`/api/phase4/admin/notifications-summary` と ops snapshot build に notification summary snapshot (`notification_operational_summary`) を追加し、snapshot-first 読取を強化する。

## スコープ
- `src/usecases/admin/getNotificationOperationalSummary.js`
- `src/usecases/admin/buildOpsSnapshots.js`
- `src/routes/admin/opsOverview.js`
- `tests/phase330/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- phase4 notifications summary route が `snapshotMode=prefer|require` を受け付ける。
- `snapshotMode=require` で snapshot 未存在時は空配列を返し fallback しない。
- ops snapshot build 結果に `notification_operational_summary` が含まれる。
- `npm run test:docs` / `npm test` / `node --test tests/phase330/*.test.js` が通る。
