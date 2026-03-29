# 12 Changed Files Rationale

## New code

- `src/domain/llm/concierge/allowedLinkPolicy.js`
  - phase1-safe user-facing link filtering
- `src/domain/llm/concierge/linkRegistry.js`
  - normalized link contract + evidence ref projection
- `src/domain/llm/concierge/faqCityPackResolver.js`
  - FAQ / City Pack response-layer projection
- `src/domain/llm/concierge/buildTaskMenuHints.js`
  - task hint + menu hint + quick reply mapping
- `src/domain/llm/concierge/buildResolutionResponse.js`
  - answer-first practical response builder
- `src/domain/llm/concierge/conciergeLayer.js`
  - phase1 scope lock + lane entrypoints

## Updated runtime files

- `src/routes/webhookLine.js`
  - phase1 lane integration through existing semantic envelope
- `src/usecases/notifications/sendWelcomeMessage.js`
  - welcome lane adopts concierge shaping
- `src/v1/line_renderer/fallbackRenderer.js`
  - service ack adopts concierge shaping

## Validation / drift gate support

- `scripts/check_structural_cleanup.js`
  - static unreachable allowlist now classifies `codexOnlyClosureContracts.js` as contract-only helper instead of unexpected drift
- `docs/REPO_AUDIT_INPUTS/unreachable_classification.json`
  - add-only classification row for `src/domain/llm/closure/codexOnlyClosureContracts.js`
- `docs/REPO_AUDIT_INPUTS/*`
  - regenerated audit-core / repo-map / docs-artifacts / audit-inputs outputs after concierge layer changes

## Tests

- `tests/phase907/*`
- `tests/phase908/*`
- `tests/phase909/*`
- `tests/phase910/*`
