# Test-Anchor Closure Plan

## New Test Files
- `tests/phase860/phase860_t01_codex_binding_and_variant_contract.test.js`
- `tests/phase860/phase860_t02_codex_test_anchor_contract.test.js`

## Covered Anchor Types
- `exact_string_assert`
- `route_contract_assert`
- `output_shape_assert`
- `binding_contract_assert`
- `variant_key_assert`

## Closure Summary
- binding anchor closed for `leaf_free_retrieval_empty_reply`
- variant key anchors closed for 4 leaves via deterministic contract maps
- exact/output/route anchors added for the 16 `codex_test_anchor_closure_candidate` leaves using current source strings or deterministic composition from current source helpers

## Important Handling
- `leaf_webhook_low_relevance_clarify` was anchored via deterministic composition using current source helpers (`composeConversationDraftFromSignals`, `selectConversationStyle`, `humanizeConversationMessage`) because the final assembled text is not stored as one literal line in `webhookLine.js`.
- `leaf_paid_finalizer_fallback` uses source-level exact fallback string plus runtime output-shape assertions because current runtime shaping passes through guard behavior.
