# PHASE214_PLAN

## 目的
- `/admin/app` の LLMペインから、同一 traceId で監査ペインへドリルダウンできる導線を追加する。

## Scope IN
- `apps/admin/app.html` に「証跡を開く」操作を追加
- `apps/admin/assets/admin_app.js` に LLM traceId を audit 検索へ引き継ぐ処理を追加
- `docs/ADMIN_UI_DICTIONARY_JA.md` に `ui.label.llm.openAudit` を add-only 追記
- UI 回帰テスト追加
- 実行ログ追加

## Scope OUT
- `/api/admin/trace` API 仕様変更
- 監査ログ保存ロジック変更
- LLM出力ロジック変更

## Target Files
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `tests/phase214/phase214_admin_app_llm_audit_flow.test.js`
- `docs/PHASE214_EXECUTION_LOG.md`

## Acceptance / Done
- LLMペインで「証跡を開く」を押すと audit ペインへ遷移する
- LLM traceId が audit-trace へコピーされる
- audit 検索が即時実行される
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase214/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE214_EXECUTION_LOG.md`
