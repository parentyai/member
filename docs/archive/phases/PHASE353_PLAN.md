# PHASE353_PLAN

## 目的
Phase353 の add-only 補強を実施し、summary/state 応答で fallback 利用診断メタを統一する。

## スコープ
- `src/usecases/admin/getUserOperationalSummary.js`
- `src/usecases/admin/getNotificationOperationalSummary.js`
- `src/usecases/phase5/getUserStateSummary.js`
- `src/routes/admin/opsOverview.js`
- `src/routes/phase5Ops.js`
- `src/routes/phase5State.js`
- `tests/phase353/*`
- `docs/SSOT_INDEX.md`

## 受入条件
- `fallbackUsed/fallbackBlocked/fallbackSources` を add-only で返却する。
- 既存レスポンスキーは維持される。
- `npm run test:docs` / `npm test` が通る。
