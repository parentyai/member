# Scope Lock

## In Scope

- `leaf_citypack_feedback_received`
- `leaf_line_renderer_render_failure`
- `leaf_paid_finalizer_refuse`
- `leaf_paid_readiness_clarify_default`
- `leaf_paid_readiness_hedge_suffix`
- `leaf_paid_readiness_refuse_default`
- `leaf_webhook_guard_missing_reply_fallback`
- `leaf_webhook_readiness_clarify`
- `leaf_webhook_readiness_refuse`
- `leaf_webhook_retrieval_failure_fallback`
- `leaf_webhook_synthetic_ack`
- `leaf_welcome_message`

## Out of Scope

- `ready_after_binding_contract = 1`
- `ready_after_variant_keying = 4`
- shell `7`
- human/policy freeze `8`
- intentionally excluded `4`
- shadow / isolate / unknown

## Locked Rule

- registry count must remain `12`
- any leaf not in the list above is a failure for this execution
