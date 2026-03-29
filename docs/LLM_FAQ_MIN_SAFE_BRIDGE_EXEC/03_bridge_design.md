# Bridge Design

## Core Rule

- keep existing literal
- read registry literal first
- fallback to the existing literal immediately if registry lookup fails

## Helper

- new helper:
  - `getMinSafeApplyLiteral(leafId, fallbackLiteral)`
- location:
  - `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/closure/minSafeApplyRegistry.js`

## Design Pattern Used

- `registry value ?? existing literal`
- no target leaf changes output shape
- no target leaf changes route contract
- no target leaf changes selector meaning

## Touch Files

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/closure/minSafeApplyRegistry.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/quality/applyAnswerReadinessDecision.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/orchestrator/finalizeCandidate.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/v1/line_renderer/lineChannelRenderer.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/notifications/sendWelcomeMessage.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/cityPackFeedbackMessages.js`
