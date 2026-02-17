# PHASE208_PLAN

## 目的
- LLM × DB 統合を安全側に固定する（FAQ KB限定 / citations必須 / 二重ゲート / 監査強化）。

## Scope IN
- FAQ KB用 Repo/usecase/route 追加
- `system_flags` に `llmEnabled` 追加（default false）
- LLM入力 Allow-list view と LLM出力 guard 追加
- `/api/admin/llm/config/*` 追加
- `/api/phaseLLM4/faq/answer` 互換維持（deprecated委譲）
- docs と tests の閉路整備

## Scope OUT
- LLM provider 実接続（本PRはDI/stub前提）
- admin master UI への LLM操作パネル追加
- killSwitch の責務変更

## Target Files
- `docs/LLM_DB_INTEGRATION_SPEC.md`
- `docs/LLM_KB_SPEC.md`
- `docs/LLM_GUARDRAILS.md`
- `docs/LLM_DATA_MINIMIZATION.md`
- `docs/LLM_RUNBOOK.md`
- `docs/LLM_API_SPEC.md`
- `docs/LLM_PHASE_PLAN.md`
- `docs/SSOT_INDEX.md`
- `src/repos/firestore/systemFlagsRepo.js`
- `src/repos/firestore/faqArticlesRepo.js`
- `src/repos/firestore/faqAnswerLogsRepo.js`
- `src/usecases/llm/buildLlmInputView.js`
- `src/usecases/llm/guardLlmOutput.js`
- `src/usecases/faq/answerFaqFromKb.js`
- `src/usecases/phaseLLM2/getOpsExplanation.js`
- `src/usecases/phaseLLM3/getNextActionCandidates.js`
- `src/usecases/phaseLLM4/getFaqAnswer.js`
- `src/routes/admin/llmConfig.js`
- `src/routes/admin/llmFaq.js`
- `src/routes/phaseLLM4FaqAnswer.js`
- `src/index.js`
- `tests/phaseLLM6/*.test.js`
- `tests/security/phaseLLM4_admin_protection.test.js`
- `docs/PHASE208_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase208.log`

## Acceptance / Done
- FAQ が KB候補0件/citations0件 で 422 BLOCK
- FAQ が direct URL / WARN link を返さない
- `llmEnabled` default false（system_flags）
- LLM有効判定が `llmEnabled AND LLM_FEATURE_FLAG`
- `/api/phaseLLM4/faq/answer` が互換維持（deprecated）
- `npm run test:docs` PASS
- `npm test` PASS
- CI証跡保存
- working tree CLEAN

## Verification
- `node --test tests/phaseLLM6/*.test.js`
- `node --test tests/phaseLLM1/*.test.js tests/phaseLLM2/*.test.js tests/phaseLLM3/*.test.js tests/phaseLLM4/*.test.js tests/phaseLLM5/*.test.js`
- `node --test tests/security/phaseLLM4_admin_protection.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE208_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase208.log`
