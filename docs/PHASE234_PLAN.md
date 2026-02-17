# PHASE234_PLAN

## 目的
- LLM監査に法務ポリシースナップショット（`llmPolicy`）を常在させ、`consent_missing` を fail-closed でブロックする。

## Scope IN
- `system_flags.phase0.llmPolicy` の get/set 正規化を repo に追加
- `/api/admin/llm/config/(status|plan|set)` に `llmPolicy` を add-only 拡張
- FAQ/Ops/NextAction の監査 payloadSummary に `lawfulBasis/consentVerified/crossBorder/blockedReasonCategory/fieldCategoriesUsed` を追加
- `lawfulBasis=consent` かつ `consentVerified=false` のとき FAQ/Ops/NextAction を `consent_missing` でブロック
- phase234 テスト追加

## Scope OUT
- LLM provider/model 変更
- FAQ 検索ロジックの embedding 拡張
- UI の新規導線追加

## Target Files
- `src/repos/firestore/systemFlagsRepo.js`
- `src/routes/admin/llmConfig.js`
- `src/usecases/faq/answerFaqFromKb.js`
- `src/usecases/phaseLLM2/getOpsExplanation.js`
- `src/usecases/phaseLLM3/getNextActionCandidates.js`
- `docs/LLM_API_SPEC.md`
- `docs/LLM_DATA_MINIMIZATION.md`
- `docs/LLM_DB_INTEGRATION_SPEC.md`
- `docs/LLM_RUNBOOK.md`
- `tests/phase234/phase234_llm_policy_config_api.test.js`
- `tests/phase234/phase234_faq_consent_missing_blocks.test.js`
- `tests/phase234/phase234_ops_next_actions_audit_policy_fields.test.js`
- `docs/PHASE234_EXECUTION_LOG.md`

## Acceptance / Done
- `llmPolicy` が config API で status/plan/set すべて扱える
- `planHash` が `llmEnabled + llmPolicy` の組で検証される
- `consent_missing` ブロックが FAQ で発火し、監査に記録される
- Ops/NextAction 監査に `llmPolicy` と `fieldCategoriesUsed` が含まれる
- `node --test tests/phase234/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS

## Verification
- `node --test tests/phase234/*.test.js`
- `npm run test:docs`
- `npm test`
