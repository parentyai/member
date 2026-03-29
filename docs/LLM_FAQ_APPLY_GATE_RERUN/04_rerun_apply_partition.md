# Rerun Apply Partition

## Baseline Summary

Prior apply-gate baseline:

- generated drafts: `35`
- apply classes:
  - `literal_apply_candidate = 16`
  - `parameterized_apply_candidate = 3`
  - `keyed_variant_candidate = 7`
  - `copy_shell_only = 7`
  - `blocked_apply = 2`
- final readiness:
  - `ready_literal_now = 0`
  - `ready_after_binding_contract = 1`
  - `ready_after_variant_keying = 0`
  - `shell_only_not_for_apply = 7`
  - `blocked_apply = 27`

## Current Apply Classes

Closure execution added binding freeze, variant freeze, and test anchors, but it did not change wording shape families. Current apply classes therefore remain:

- `literal_apply_candidate = 16`
- `parameterized_apply_candidate = 3`
- `keyed_variant_candidate = 7`
- `copy_shell_only = 7`
- `blocked_apply = 2`

## Current Final Readiness

After rerun on `codex/llm-closure-pack-bind-variant-test`:

- `ready_literal_now = 16`
- `ready_after_binding_contract = 1`
- `ready_after_variant_keying = 4`
- `shell_only_not_for_apply = 7`
- `blocked_apply = 7`

## Newly Ready Literal Now

- `leaf_paid_readiness_clarify_default`
- `leaf_paid_readiness_refuse_default`
- `leaf_paid_readiness_hedge_suffix`
- `leaf_paid_finalizer_fallback`
- `leaf_paid_finalizer_refuse`
- `leaf_webhook_guard_missing_reply_fallback`
- `leaf_webhook_low_relevance_clarify`
- `leaf_webhook_retrieval_failure_fallback`
- `leaf_webhook_readiness_clarify`
- `leaf_webhook_readiness_refuse`
- `leaf_webhook_synthetic_ack`
- `leaf_welcome_message`
- `leaf_line_renderer_overflow_summary`
- `leaf_line_renderer_deeplink_generic`
- `leaf_line_renderer_render_failure`
- `leaf_citypack_feedback_received`

## Newly Ready After Binding Contract

- `leaf_free_retrieval_empty_reply`

## Newly Ready After Variant Keying

- `leaf_webhook_consent_state_ack`
- `leaf_line_renderer_service_ack`
- `leaf_region_prompt_or_validation`
- `leaf_region_state_ack`

## Still Blocked

- `leaf_paid_reply_guard_defaults`
- `leaf_line_renderer_deeplink_with_url`
- `leaf_webhook_direct_command_ack`
- `leaf_notification_body_default`
- `leaf_notification_textmode_cta_join`
- `leaf_task_flex_labels`
- `leaf_task_flex_buttons`

## Unchanged Shell

- `leaf_free_style_quick`
- `leaf_free_style_coach`
- `leaf_free_style_checklist`
- `leaf_free_style_timeline`
- `leaf_free_style_weekend`
- `leaf_paid_conversation_format_shell`
- `leaf_citypack_feedback_usage`

## Key Judgment

The rerun promotes all 21 codex-only closure candidates out of prior `blocked_apply`, but it does not promote any shell leaf or any human/policy freeze leaf.
