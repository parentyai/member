# Phase272 Plan

## Goal
- `/admin/app?pane=composer` をタイプ駆動フォーム + LINE風ライブプレビュー + 保存済み通知一覧へ再構成し、既存通知契約を維持する。

## Scope
- `/Users/parentyai.com/Projects/Member/apps/admin/app.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin_app.js`
- `/Users/parentyai.com/Projects/Member/apps/admin/assets/admin.css`
- `/Users/parentyai.com/Projects/Member/src/usecases/notifications/createNotification.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/osNotifications.js`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/osLinkRegistryLookup.js`
- `/Users/parentyai.com/Projects/Member/src/index.js`
- `/Users/parentyai.com/Projects/Member/docs/ADMIN_UI_DICTIONARY_JA.md`
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md`
- `/Users/parentyai.com/Projects/Member/tests/phase272/*`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE272_EXECUTION_LOG.md`

## Out of scope
- `/admin/composer` legacy HTML の全面改修
- 既存通知送信ロジック（Policy/validator）の意味変更
- 直URL入力の許可
- 新規通知タイプ専用の送信判定追加

## Acceptance
- composer pane で通知タイプに応じて入力項目が切り替わる。
- 非`STEP`で `scenarioKey=A`, `stepKey=week`, `target.limit=50` が自動適用される。
- 右カラムのライブプレビューが入力値と `linkRegistryId` lookup 結果を反映する。
- 保存済み通知リストの取得・検索・行読み込み・複製が動作する。
- 危険操作（承認/実行）で確認ダイアログを要求し、`traceId` ヘッダーを継続送信する。
- `npm run test:docs` / `npm test` / `node --test tests/phase272/*.test.js` が PASS。

## Rollback
- PR単位 `git revert <merge_commit>`
