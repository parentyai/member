# Phase588 Plan

## Goal
phase5 state summary usecase の global `listAll*` fallback を bounded range fallback へ置換し、phase4 と read-path 契約を揃える。

## Scope
- `/Users/parentyai.com/Projects/Member/src/usecases/phase5/getUserStateSummary.js`
- `/Users/parentyai.com/Projects/Member/tests/phase588/*`
- 既存互換テストの最小更新

## Non-Goals
- route 追加
- API 既存キー変更
- snapshot/read policy 既定変更

## Contract
- fallback source は `list*By...Range:fallback` を使用
- `fallbackMode=block` が最優先で fallback 停止
- `fallbackOnEmpty` の既存意味は維持

## Acceptance
- phase5 state usecase 内の `listAllEvents/listAllNotificationDeliveries/listAllChecklists/listAllUserChecklists` callsite が除去される
- `npm run docs-artifacts:check`, `npm run test:docs`, `npm test` が pass

