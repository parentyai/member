# Variant Key Freeze Plan

## Executed Variant Families

### `leaf_webhook_consent_state_ack`
- `consent_granted`
- `consent_revoked`
- observed source: `src/routes/webhookLine.js`

### `leaf_line_renderer_service_ack`
- `service_ack_wait`
- `service_ack_prepare`
- `service_ack_display`
- observed sources:
  - `src/v1/line_renderer/fallbackRenderer.js`
  - `src/v1/line_renderer/semanticLineMessage.js`

### `leaf_region_prompt_or_validation`
- `prompt_required`
- `invalid_format`
- observed source: `src/domain/regionLineMessages.js`

### `leaf_region_state_ack`
- `declared`
- `already_set`
- observed sources:
  - `src/domain/regionLineMessages.js`
  - `src/routes/webhookLine.js`

## Implementation Shape
- add-only key freezes live in `src/domain/llm/closure/codexOnlyClosureContracts.js`
- no wording changed
- no runtime branch behavior changed
- no extra keys invented beyond closure pack canonical names
