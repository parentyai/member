# Phase UI-TABLE-264 Plan

## Goal
- 「表は読む」「入力は迷わせない」を最小UIの範囲で実装し、詳細を開いた時の読解コストを下げる。

## Scope
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin.css`
- `/Users/parentyai.com/Projects/Member/tests/phase264/*`

## Out of scope
- 新規API追加
- 列の増加 / 説明ブロック追加
- 新規集計コレクション追加

## Acceptance
- `<details class="table-section">` 内の table がスクロール可能になり、ヘッダが sticky になる
- 数値列の右寄せユーティリティ（`.cell-num`）を導入し、主要テーブルで適用される
- Vendor一覧でキーボード操作（↑/↓で移動、Enterで選択）ができる
- `npm run test:docs` と `npm test` が通る

## Rollback
- PR単位の `git revert` で切戻し

