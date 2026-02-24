# Phase589 Plan

## Goal
phase2 automation の residual `listAll*` fallback を bounded range fallback へ置換し、hotspot を最小化する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/usecases/phase2/runAutomation.js`
- `/Users/parentyai.com/Projects/Member/tests/phase322/*`
- `/Users/parentyai.com/Projects/Member/tests/phase359/*`
- `/Users/parentyai.com/Projects/Member/tests/phase589/*`

## Non-Goals
- automation route 契約の破壊的変更
- Firestore schema 変更
- fallbackMode 既定値変更

## Contract
- `fallbackMode=allow` は bounded fallback を維持（互換）
- `fallbackMode=block` は not_available を維持
- 既存 summary キーは削除しない

## Acceptance
- phase2 usecase 内 `listAllEvents/listAllUsers/listAllChecklists/listAllUserChecklists` callsite が除去される
- `npm run docs-artifacts:check`, `npm run test:docs`, `npm test` が pass

