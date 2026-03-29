# Before / After Diff

## Summary

- closure candidates reviewed: `21`
- promoted: `21`
- not promoted within closure focus: `0`
- note: `leaf_paid_reply_guard_defaults` changes outside the closure-focus set because it belongs to the human/policy freeze pack and is therefore no longer treated as rerun-ready

## Binding Closure

### `leaf_free_retrieval_empty_reply`

- prior primary blocker:
  - `binding_missing_only`
  - `weak_exact_string_anchor`
  - `weak_output_shape_anchor`
- closure actions executed:
  - binding source freeze in `src/domain/llm/closure/codexOnlyClosureContracts.js`
  - exact-string and output-shape anchors in `tests/phase860/phase860_t01_codex_binding_and_variant_contract.test.js`
- current blocker:
  - none that prevents `ready_after_binding_contract`
- promoted: `true`
- promoted to: `ready_after_binding_contract`
- next owner: `none`

## Variant Closure

### `leaf_webhook_consent_state_ack`

- prior blocker: `variant_key_missing_only`
- closure actions: canonical key freeze + exact-string anchor
- current blocker: none for variant-key readiness
- promoted to: `ready_after_variant_keying`

### `leaf_line_renderer_service_ack`

- prior blocker: `variant_key_missing_only`
- closure actions: canonical key freeze + route/output anchors
- current blocker: none for variant-key readiness
- promoted to: `ready_after_variant_keying`

### `leaf_region_prompt_or_validation`

- prior blocker: `variant_key_missing_only`
- closure actions: key freeze for `prompt_required` and `invalid_format` + clarify anchors
- current blocker: none for variant-key readiness
- promoted to: `ready_after_variant_keying`

### `leaf_region_state_ack`

- prior blocker:
  - `binding_and_variant_missing`
- closure actions:
  - city/state binding freeze
  - `declared` and `already_set` key freeze
  - command_ack anchors
- current blocker: none for variant-key readiness
- promoted to: `ready_after_variant_keying`

## Test-Anchor Closure

The following leaves move from prior `blocked_apply` to current `ready_literal_now` because their primary blockers were anchor deficits only and those anchors now exist in the current tree:

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

## Non-Promotions

### Human / Policy Freeze Persistence

- `leaf_paid_reply_guard_defaults`
- `leaf_line_renderer_deeplink_with_url`
- `leaf_webhook_direct_command_ack`
- `leaf_task_flex_labels`
- `leaf_task_flex_buttons`
- `leaf_notification_body_default`
- `leaf_notification_textmode_cta_join`

### Shell Persistence

- `leaf_free_style_quick`
- `leaf_free_style_coach`
- `leaf_free_style_checklist`
- `leaf_free_style_timeline`
- `leaf_free_style_weekend`
- `leaf_paid_conversation_format_shell`
- `leaf_citypack_feedback_usage`
