# PHASE336_PLAN

## 目的
Retention dry-run/apply の監査証跡を admin から追跡可能にする read-only API (`/api/admin/retention-runs`) を追加する。

## スコープ
- `src/routes/admin/retentionRuns.js`
- `src/index.js`
- `tests/phase336/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- `/api/admin/retention-runs?limit=&traceId=` が動作する。
- 対象 action は `retention.dry_run.execute|retention.apply.execute|retention.apply.blocked` のみ。
- 応答に `traceId/deletedCount/collection(s)/sampleDeletedIds/dryRunTraceId` を含む。
- `npm run test:docs` / `npm test` / `node --test tests/phase336/*.test.js` が通る。
