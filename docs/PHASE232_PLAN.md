# PHASE232_PLAN

## 目的
- FAQ が 422 BLOCK になったとき、管理UIで「停止理由 / 代替アクション / 候補FAQ」を即時表示できるようにする。

## Scope IN
- FAQ usecase の 422 payload を add-only 拡張（`blockedReasonCategory` / `fallbackActions` / `suggestedFaqs`）
- `/admin/app` と `/admin/master` の FAQ 結果表示に BLOCK UX パネルを追加
- UI辞書 add-only 追記
- phase232 テスト追加

## Scope OUT
- LLM policy snapshot (`llmPolicy`) 追加
- embedding 検索
- ユーザー向け FAQ 導線公開

## Target Files
- `src/usecases/faq/answerFaqFromKb.js`
- `apps/admin/app.html`
- `apps/admin/master.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `docs/LLM_API_SPEC.md`
- `docs/LLM_DB_INTEGRATION_SPEC.md`
- `tests/phase232/phase232_faq_block_payload_contract.test.js`
- `tests/phase232/phase232_admin_block_ux_markup.test.js`
- `docs/PHASE232_EXECUTION_LOG.md`

## Acceptance / Done
- FAQ 422 payload に `blockedReasonCategory` / `fallbackActions` / `suggestedFaqs` が常在
- `/admin/app` と `/admin/master` の FAQ セクションで BLOCK UX パネル表示
- `node --test tests/phase232/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase232/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE232_EXECUTION_LOG.md`
