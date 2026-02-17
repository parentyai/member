# PHASE212_PLAN

## 目的
- `/admin/app` の統合シェルで LLM 検証（Ops説明 / 次アクション候補 / FAQ回答）を管理者が実行できるようにする。

## Scope IN
- `apps/admin/app.html` に LLM ナビと LLM ペインを追加
- `apps/admin/assets/admin_app.js` に LLM 実行ハンドラを追加
- `docs/ADMIN_UI_DICTIONARY_JA.md` に `ui.*` キーを add-only 追記
- UI 回帰テスト追加
- 実行ログ追加

## Scope OUT
- LLM API 仕様変更
- LLM schema / guard / DB 変更
- `/admin/master` 既存 LLM パネルの挙動変更

## Target Files
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `tests/phase212/phase212_admin_app_llm_panel.test.js`
- `docs/PHASE212_EXECUTION_LOG.md`

## Acceptance / Done
- admin app で LLM ナビ（管理者）と LLM ペインが表示される
- lineUserId/質問の入力不足を UI 側で拒否できる
- 3つの既存エンドポイントに接続し JSON 結果を表示できる
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase212/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE212_EXECUTION_LOG.md`
