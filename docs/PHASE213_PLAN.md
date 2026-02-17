# PHASE213_PLAN

## 目的
- `/admin/app` の LLM ペインに LLM設定（status/plan/set）導線を追加し、管理者が統合シェル上で設定確認と適用を行えるようにする。

## Scope IN
- `apps/admin/app.html` に LLM設定 UI を追加
- `apps/admin/assets/admin_app.js` に `/api/admin/llm/config/*` 呼び出しを追加
- `docs/ADMIN_UI_DICTIONARY_JA.md` に LLM設定 UI 用の `ui.*` キーを add-only 追記
- UI 回帰テスト追加
- 実行ログ追加

## Scope OUT
- LLM設定 API 仕様変更
- `src/routes/admin/llmConfig.js` のロジック変更
- LLMガード/FAQ/Ops/NextAction usecase 変更

## Target Files
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `tests/phase213/phase213_admin_app_llm_config_panel.test.js`
- `docs/PHASE213_EXECUTION_LOG.md`

## Acceptance / Done
- admin app の LLM ペインで status/plan/set ボタンが動作する
- plan前の set は UI 側で拒否する
- `/api/admin/llm/config/status|plan|set` の結果 JSON を画面表示できる
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase213/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE213_EXECUTION_LOG.md`
