# Scope Lock

## Rerun Focus

The rerun focuses on the 21 codex-only closure candidates.

### Binding Closure Focus

- `leaf_free_retrieval_empty_reply`

### Variant Closure Focus

- `leaf_webhook_consent_state_ack`
- `leaf_line_renderer_service_ack`
- `leaf_region_prompt_or_validation`
- `leaf_region_state_ack`

### Test-Anchor Closure Focus

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

## No-Change Buckets

### GPT Re-authoring Required

- `leaf_free_style_quick`
- `leaf_free_style_coach`
- `leaf_free_style_checklist`
- `leaf_free_style_timeline`
- `leaf_free_style_weekend`
- `leaf_paid_conversation_format_shell`

### Human / Policy Freeze Required

- `leaf_paid_reply_guard_defaults`
- `leaf_line_renderer_deeplink_with_url`
- `leaf_webhook_direct_command_ack`
- `leaf_task_flex_labels`
- `leaf_task_flex_buttons`
- `leaf_notification_body_default`
- `leaf_notification_textmode_cta_join`
- `leaf_citypack_feedback_usage`

### Shadow / Isolate / Unknown

- rerun target excludes shadow, isolate, and unknown leaves
- no leaf in those classes is promoted in this rerun

## Audit Rule

No leaf outside the 21 codex-only closure candidates is eligible for positive promotion in this rerun. Out-of-scope leaves can only remain unchanged or remain blocked.
