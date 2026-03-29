# 04 Architecture Decision

## Decision

Use an add-only concierge layer between existing candidate generation and existing semantic rendering.

## Why

- `webhookLine.js` already centralizes `buildSemanticReplyEnvelope(...)`
- `composeConciergeReply.js` already selects URLs and computes source readiness
- `semantic_response_object` already supports `tasks`, `evidence_refs`, `quick_replies`

## Add-only modules

- `src/domain/llm/concierge/allowedLinkPolicy.js`
- `src/domain/llm/concierge/linkRegistry.js`
- `src/domain/llm/concierge/faqCityPackResolver.js`
- `src/domain/llm/concierge/buildTaskMenuHints.js`
- `src/domain/llm/concierge/buildResolutionResponse.js`
- `src/domain/llm/concierge/conciergeLayer.js`

## Non-decisions

- no semantic schema rewrite
- no route ownership rewrite
- no Firestore schema rewrite
- no task engine redesign
