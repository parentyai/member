# PHASE231_PLAN

## 目的
- FAQ/Ops/NextAction に用途別免責テンプレを固定し、`disclaimerVersion` をレスポンスと監査に常在させる。

## Scope IN
- 免責テンプレモジュール `src/llm/disclaimers.js` 追加
- FAQ/Ops/NextAction usecase に `disclaimerVersion` / `disclaimer` 追加
- audit_logs に `llm_disclaimer_rendered` を append-only 追加
- 関連 docs 更新
- phase231 テスト追加

## Scope OUT
- UI での免責表示位置変更
- 監査 `blockedReasonCategory` 拡張
- llmPolicy スナップショット拡張

## Target Files
- `src/llm/disclaimers.js`
- `src/usecases/faq/answerFaqFromKb.js`
- `src/usecases/phaseLLM2/getOpsExplanation.js`
- `src/usecases/phaseLLM3/getNextActionCandidates.js`
- `docs/LLM_GUARDRAILS.md`
- `docs/LLM_RUNBOOK.md`
- `docs/LLM_DB_INTEGRATION_SPEC.md`
- `docs/LLM_API_SPEC.md`
- `tests/phase231/phase231_disclaimer_version_in_faq_response_and_audit.test.js`
- `tests/phase231/phase231_disclaimer_version_in_ops_next_actions.test.js`
- `docs/PHASE231_EXECUTION_LOG.md`

## Acceptance / Done
- FAQ/Ops/NextAction レスポンスに `disclaimerVersion` が常在
- FAQ/Ops/NextAction 監査 payload に `disclaimerVersion` が記録される
- `llm_disclaimer_rendered` 監査イベントが append-only で追加される
- `node --test tests/phase231/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase231/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE231_EXECUTION_LOG.md`
