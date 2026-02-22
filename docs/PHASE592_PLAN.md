# Phase592 Plan

## Goal
missing-index fallback surface を admin read-only API で参照可能にし、運用監視を実装ログに接続する。

## Scope
- `/Users/parentyai.com/Projects/Member/src/routes/admin/missingIndexSurface.js` (new)
- `/Users/parentyai.com/Projects/Member/src/index.js`
- `/Users/parentyai.com/Projects/Member/tests/phase592/*`

## Non-Goals
- write API 追加
- security policy 変更

## Contract
- `GET /api/admin/missing-index-surface?limit=&fileContains=`
- `/api/admin/*` 既存 adminToken 保護を利用
- 監査 action: `missing_index.surface.view`

## Acceptance
- route が index に接続される
- normalized payload (`surfaceCount`, `pointCount`, `items`) を返す
- view audit log が残る
