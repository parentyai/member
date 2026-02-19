# Phase273 Plan

## Goal
- City Pack拡張 PR7 として、`city_pack_metrics_daily` の最小効果測定（pack/slot/sourceRef単位）を add-only で実装する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/cityPackMetricsDailyRepo.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/cityPack/computeCityPackMetrics.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/cityPackReviewInbox.js`
- `/Users/parentyai.com/Projects/Member/src/index.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md`
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md`
- `/Users/parentyai.com/Projects/Member/tests/phase273/*`
- `/Users/parentyai.com/Projects/Member/docs/PHASE273_EXECUTION_LOG.md`

## Out of scope
- Firestore Rules の本番適用
- Cloud Run Job による定期集計
- 個人単位の詳細トラッキング強化
- 既存通知送信ロジック（validators/SOURCE_*）の意味変更

## Acceptance
- `GET /api/admin/city-pack-metrics?windowDays=7|30&limit=` が admin token 必須で動作する。
- `city_pack_metrics_daily` に日次集計行が upsert される。
- `/admin/app` City Pack pane で metrics 表示（期間切替/件数/更新）ができる。
- `traceId` 付きで `audit_logs` に `city_pack.metrics.view` が追記される。
- `npm run test:docs` / `npm test` / `node --test tests/phase273/*.test.js` が PASS。

## Rollback
- PR単位 `git revert <merge_commit>`
