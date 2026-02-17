# PHASE235_PLAN

## 目的
- ユーザー向け導入を想定し、FAQ の guide-only モードを厳格化する。
- free-chat を禁止し、personalization は `locale|servicePhase` のみ許可する。

## Scope IN
- FAQ usecase に `guideMode` / `personalization` の allow-list ガード追加
- BLOCK reason 追加（`guide_only_mode_blocked`, `personalization_not_allowed`）
- 監査 payloadSummary に `guideMode` / `personalizationKeys` 追加
- admin FAQ route / 互換 route に `guideMode` / `personalization` 入力受け渡し追加
- phase235 テスト追加

## Scope OUT
- 新しい user API ルート追加
- FAQ KB 検索ロジック変更
- LLM provider/model 変更

## Target Files
- `src/usecases/faq/answerFaqFromKb.js`
- `src/routes/admin/llmFaq.js`
- `src/routes/phaseLLM4FaqAnswer.js`
- `docs/LLM_DB_INTEGRATION_SPEC.md`
- `docs/LLM_API_SPEC.md`
- `docs/LLM_DATA_MINIMIZATION.md`
- `docs/LLM_RUNBOOK.md`
- `docs/LLM_PHASE_PLAN.md`
- `tests/phase235/phase235_guide_only_mode_blocks_free_chat.test.js`
- `tests/phase235/phase235_personalization_beyond_locale_blocked.test.js`
- `tests/phase235/phase235_guide_mode_checklist_guidance_allowed.test.js`
- `docs/PHASE235_EXECUTION_LOG.md`

## Acceptance / Done
- `guideMode=free_chat` で 422 `guide_only_mode_blocked`
- personalization に allow-list 外キーがあると 422 `personalization_not_allowed`
- `guideMode=checklist_guidance` + allow-list personalization は成功可能
- `node --test tests/phase235/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS

## Verification
- `node --test tests/phase235/*.test.js`
- `npm run test:docs`
- `npm test`
