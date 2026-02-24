# Phase593 Plan

## Goal
maintenance pane に missing-index fallback surface の read-only 可視化を追加する。

## Scope
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md`
- `/Users/parentyai.com/Projects/Member/tests/phase593/*`

## Non-Goals
- 操作系 UI（修復実行）の追加
- 新規 admin HTML の追加

## Contract
- maintenance pane に panel 追加
- endpoint は既存 `GET /api/admin/missing-index-surface` を利用
- role/admin 表示と既存導線を維持

## Acceptance
- UI reload で missing-index surface を更新表示できる
- dictionary key が追加される
- 既存 maintenance sections を壊さない
