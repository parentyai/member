# PHASE215_PLAN

## 目的
- `/admin/app` の LLM実行（Ops説明 / 次候補）を admin 名前空間 API へ統一し、旧 phaseLLM2/3 ルートは互換フォールバックとして維持する。

## Scope IN
- `src/index.js` に `/api/admin/llm/ops-explain` と `/api/admin/llm/next-actions` を追加
- `src/routes/admin/llmOps.js` を追加（既存 usecase 呼び出し）
- `apps/admin/assets/admin_app.js` を admin API 優先 + 旧APIフォールバックへ変更
- `docs/LLM_API_SPEC.md` を add-only 更新
- 回帰テスト追加
- 実行ログ追加

## Scope OUT
- phaseLLM2/3 usecase ロジック変更
- LLM schema / guard / DB 変更
- 既存 `/api/phaseLLM2/*` `/api/phaseLLM3/*` 互換ルート削除

## Target Files
- `src/index.js`
- `src/routes/admin/llmOps.js`
- `apps/admin/assets/admin_app.js`
- `docs/LLM_API_SPEC.md`
- `tests/phase215/phase215_admin_app_llm_ops_endpoints.test.js`
- `tests/phase215/phase215_admin_llm_ops_routes_protected.test.js`
- `docs/PHASE215_EXECUTION_LOG.md`

## Acceptance / Done
- `/api/admin/llm/ops-explain` と `/api/admin/llm/next-actions` が利用可能
- admin app は admin API を優先し、404 時のみ旧 endpoint にフォールバック
- admin token 保護が維持される（401 fail-closed）
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase215/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE215_EXECUTION_LOG.md`
