# Phase UI-MINIMAL-261 Plan

## Goal
- `/admin/app` を最小判断UIへ統一する。
- 初期表示は `状態 + 理由2行 + 今やること3ボタン`。
- 詳細は `<details>`（初期閉）へ退避する。
- 既存API互換と既存通知/City Pack/LLMの安全ガードは維持する。

## Scope
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`
- `src/routes/admin/vendors.js`（add-only facade）
- `src/index.js`（route add-only + legacy redirect）
- `docs/ADMIN_UI_DICTIONARY_JA.md`（add-only）
- `tests/phase261/*`

## Out of scope
- 公共API連携の新規実装
- 既存通知ロジックの意味変更
- Firestoreコレクション追加

## Acceptance
- summary-header/今日の流れを `/admin/app` から除去
- 対象ペイン（通知/配信結果/異常対応/通知集計/Vendor/City Pack）に decision-card を追加
- `ATTENTION/STOP` のときのみ詳細自動展開
- `/api/admin/vendors` facade が add-only で動作
- `/admin/composer|monitor|errors|read-model` が `/admin/app?pane=` へ誘導
- `npm run test:docs` と `npm test` が通る

## Rollback
- PR単位の `git revert` で切戻し
