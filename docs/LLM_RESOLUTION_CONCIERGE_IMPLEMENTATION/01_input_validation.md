# 01 Input Validation

## Canonical inputs observed

- `docs/LLM_FAQ_TEMPLATE_AUDIT/**`
- `docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/05_canonical_grouping_spec.json`
- `docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/10_canonical_grouping_spec.json`
- `docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/17_artifact_authority_and_drift_guard.md`
- `docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/18_primary_mirror_lock.json`
- `docs/LLM_FAQ_LEAF_MANIFEST/**`
- `docs/LLM_FAQ_LEAF_DRAFT_CORPUS/**`
- `docs/LLM_FAQ_DRAFT_APPLY_GATE/**`
- `docs/LLM_FAQ_CLOSURE_PACK/**`
- `docs/LLM_FAQ_CODEX_CLOSURE_EXEC/**`
- `docs/LLM_FAQ_APPLY_GATE_RERUN/**`
- `docs/LLM_FAQ_MIN_SAFE_APPLY_EXEC/**`
- `Member_LLM_Integrated_Spec_V1.md`

## Workbook status

- requested workbook: missing
- effect:
  - menu bucket names use existing repo command facts
  - workbook-specific copy is not asserted as observed truth

## Runtime touchpoints observed

- `src/routes/webhookLine.js`
- `src/domain/llm/quality/applyAnswerReadinessDecision.js`
- `src/domain/llm/orchestrator/finalizeCandidate.js`
- `src/v1/line_renderer/lineChannelRenderer.js`
- `src/usecases/notifications/sendWelcomeMessage.js`
- `src/domain/cityPackFeedbackMessages.js`
- `src/domain/llm/closure/minSafeApplyRegistry.js`
- `src/domain/llm/closure/codexOnlyClosureContracts.js`
