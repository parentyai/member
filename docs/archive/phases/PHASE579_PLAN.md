# Phase579 Plan

## Goal
管理UIダッシュボードを経営・運用判断に直結する構成へ再設計し、既存契約を壊さずに `alerts` 導線と KPI 可視化を強化する。

## Scope
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin.css`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/osDashboardKpi.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/osAlerts.js` (new)
- `/Users/parentyai.com/Projects/Member/src/usecases/admin/buildOpsSnapshots.js`
- `/Users/parentyai.com/Projects/Member/src/index.js`
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md`
- `/Users/parentyai.com/Projects/Member/tests/phase579/*`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE579_EXECUTION_LOG.md`
- `/Users/parentyai.com/Projects/Member/docs/SSOT_INDEX.md`

## Non-Goals
- Firestore schema 変更
- 既存 API キー削除
- 外部チャートライブラリ導入

## Contract
- `windowMonths`: `1|3|6|12|36`
- ダッシュボードUIは `fallbackMode=block` で KPI 取得
- 新規 read-only API: `GET /api/admin/os/alerts/summary`

## Acceptance
- KPI6カード（登録者数/メンバーID登録率/エンゲージメント/通知件数/反応率/FAQ利用件数）
- トップバーに `登録者数 | 本日配信予定件数 | 要対応案件` を動的表示
- `alerts` ペイン追加（種別/件数/影響/対応）
- `npm run test:docs` と `npm test` が通る
