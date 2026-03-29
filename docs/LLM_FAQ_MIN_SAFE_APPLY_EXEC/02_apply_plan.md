# Apply Plan

## Strategy

1. Add a new registry/corpus file for the approved 12 leaves only.
2. Keep wording literal and copy the current observed runtime text exactly.
3. Add focused contract tests that prove:
   - exact string
   - output shape
   - route/source contract
4. Do not wire runtime to the new registry in this turn.
5. Record evidence and rollback instructions.

## SSOT Inputs

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_APPLY_GATE_RERUN/09_safe_minimum_apply_set_rerun.json`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CLOSURE_PACK/05_codex_only_closure_pack.json`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_LEAF_MANIFEST/05_leaf_manifest.json`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_LEAF_DRAFT_CORPUS/04_leaf_draft_corpus.json`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/Member_LLM_Integrated_Spec_V1.md`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/package.json`

## Runtime Entry Points Observed

- paid safety defaults:
  - `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/quality/applyAnswerReadinessDecision.js`
- paid finalizer:
  - `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/orchestrator/finalizeCandidate.js`
- LINE renderer fallback:
  - `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/v1/line_renderer/lineChannelRenderer.js`
- welcome notification:
  - `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/notifications/sendWelcomeMessage.js`
- citypack feedback:
  - `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/cityPackFeedbackMessages.js`
- webhook top-level:
  - `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js`
