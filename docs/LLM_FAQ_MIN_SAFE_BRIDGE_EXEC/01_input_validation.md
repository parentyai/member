# Input Validation

## Safe Minimum Source

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_APPLY_GATE_RERUN/09_safe_minimum_apply_set_rerun.json`
  - parse: `PASS`
  - target leaves: `12`

## Registry Validation

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/closure/minSafeApplyRegistry.js`
  - registry leaves: `12`
  - matches rerun safe minimum set: `PASS`
  - non-target leaves mixed in: `NO`

## Runtime Entrypoints Readable

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/quality/applyAnswerReadinessDecision.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/orchestrator/finalizeCandidate.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/v1/line_renderer/lineChannelRenderer.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/notifications/sendWelcomeMessage.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/cityPackFeedbackMessages.js`

## Excluded Buckets Preserved

- `ready_after_binding_contract = 1` untouched
- `ready_after_variant_keying = 4` untouched
- shell `7` untouched
- human/policy freeze `8` untouched
- intentionally excluded `4` untouched
