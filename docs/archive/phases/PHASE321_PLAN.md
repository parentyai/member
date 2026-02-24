# PHASE321_PLAN

## 目的
`monitor-insights` の deliveries 読み取りを sentAt bounded range query 優先へ収束し、windowDays 集計での不要読取を縮小する。

## スコープ
- `src/routes/admin/monitorInsights.js`
- `tests/phase321/*`（新規）
- `docs/SSOT_INDEX.md`

## 受入条件
- `monitorInsights` が `listNotificationDeliveriesBySentAtRange` を優先利用する。
- bounded 0件時のみ `listAllNotificationDeliveries` fallback を使う互換設計を維持する。
- `npm run test:docs` / `npm test` / `node --test tests/phase321/*.test.js` が通る。
