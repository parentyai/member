# Changed Files Rationale

## Registry Helper

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/closure/minSafeApplyRegistry.js`
  - added `getMinSafeApplyLiteral()`
  - purpose: parity-preserving bridge helper with fallback

## Runtime Touchpoints

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/quality/applyAnswerReadinessDecision.js`
  - bridge 3 paid readiness leaves
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/orchestrator/finalizeCandidate.js`
  - bridge `leaf_paid_finalizer_refuse`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js`
  - bridge 5 webhook leaves
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/v1/line_renderer/lineChannelRenderer.js`
  - bridge `leaf_line_renderer_render_failure`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/notifications/sendWelcomeMessage.js`
  - bridge `leaf_welcome_message`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/cityPackFeedbackMessages.js`
  - bridge `leaf_citypack_feedback_received`

## Tests

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase862/phase862_t01_min_safe_bridge_runtime_contract.test.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase862/phase862_t02_min_safe_bridge_webhook_contract.test.js`

## Non-Target Guard

- no bridge added for:
  - `leaf_paid_finalizer_fallback`
  - `leaf_webhook_low_relevance_clarify`
  - `leaf_line_renderer_overflow_summary`
  - `leaf_line_renderer_deeplink_generic`
