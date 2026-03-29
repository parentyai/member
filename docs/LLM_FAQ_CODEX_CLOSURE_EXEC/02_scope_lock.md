# Scope Lock

## Group A: Binding Closure
- `leaf_free_retrieval_empty_reply`

## Group B: Variant Closure
- `leaf_webhook_consent_state_ack`
- `leaf_line_renderer_service_ack`
- `leaf_region_prompt_or_validation`
- `leaf_region_state_ack`

## Group C: Test-Anchor Closure
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

## Excluded From Execution
### GPT re-authoring required
- `leaf_free_style_quick`
- `leaf_free_style_coach`
- `leaf_free_style_checklist`
- `leaf_free_style_timeline`
- `leaf_free_style_weekend`
- `leaf_paid_conversation_format_shell`

### Human/policy freeze required
- `leaf_paid_reply_guard_defaults`
- `leaf_line_renderer_deeplink_with_url`
- `leaf_webhook_direct_command_ack`
- `leaf_task_flex_labels`
- `leaf_task_flex_buttons`
- `leaf_notification_body_default`
- `leaf_notification_textmode_cta_join`
- `leaf_citypack_feedback_usage`

### Always excluded
- deferred / excluded / shadow / isolate / unknown leaves
