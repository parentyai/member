# Post Bridge Status

## Runtime-Consumed Leaves

- runtime-consumed now: `12 / 12`

## Files Receiving Bridge Logic

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/quality/applyAnswerReadinessDecision.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/orchestrator/finalizeCandidate.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/v1/line_renderer/lineChannelRenderer.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/notifications/sendWelcomeMessage.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/cityPackFeedbackMessages.js`

## Why Wording Drift Is Not Claimed

- existing literals remain as fallback
- tests compare runtime outputs to registry literals exactly
- route-source assertions confirm the bridge path while keeping the fallback literal present

## Still Not Touched

- `ready_after_binding_contract = 1`
- `ready_after_variant_keying = 4`
- shell `7`
- human/policy freeze `8`
- intentionally excluded `4`

## Apply Boundary

This turn bridges runtime consumption only for the approved 12 leaves. It does not widen apply scope.
