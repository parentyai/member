# Phase585 Plan

## Goal
dashboard / monitor の empty fallback から global `listAll*` を外し、bounded range fallback へ置換する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/routes/admin/osDashboardKpi.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/monitorInsights.js`
- `/Users/parentyai.com/Projects/Member/tests/phase585/*`
- 既存関連契約テストの互換更新

## Non-Goals
- Firestore schema 変更
- 既存 API キー削除
- snapshot/fallbackMode 契約変更

## Contract
- `fallbackOnEmpty=true` でも、empty 理由の fallback は bounded range query を使う
- `fallbackOnEmpty=false` / `fallbackMode=block` の既存契約は維持

## Acceptance
- route 内 `listAllUsers/listAllNotifications/listAllNotificationDeliveries` 呼び出しが消える
- `npm run test:docs` / `npm test` が通る

