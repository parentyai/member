# Phase587 Plan

## Goal
phase4 summary usecase の global `listAll*` fallback を bounded range fallback へ置換し、read-path の増悪再発を抑止する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/usecases/admin/getUserOperationalSummary.js`
- `/Users/parentyai.com/Projects/Member/src/usecases/admin/getNotificationOperationalSummary.js`
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/analyticsReadRepo.js`
- `/Users/parentyai.com/Projects/Member/tests/phase587/*`
- 既存互換テストの最小更新

## Non-Goals
- Firestore schema 変更
- route 契約変更
- fallbackMode / fallbackOnEmpty の既定値変更

## Contract
- fallback source は `list*By...Range:fallback` に統一
- `fallbackMode=block` / `fallbackOnEmpty` の既存契約は維持
- 既存レスポンスキー削除なし

## Acceptance
- phase4 usecase 内の `listAllEvents/listAllNotificationDeliveries/listAllChecklists/listAllUserChecklists` callsite が除去される
- `npm run docs-artifacts:check`, `npm run test:docs`, `npm test` が pass

