# Still Blocked Reasons

## Blocked Apply

### `policy_freeze_pending`

- `leaf_paid_reply_guard_defaults`
- `leaf_line_renderer_deeplink_with_url`
- `leaf_webhook_direct_command_ack`
- `leaf_task_flex_labels`
- `leaf_task_flex_buttons`

Reason:

- closure execution did not decide canonical owner policy, optionality policy, or binding-owner policy

### `format_placeholder_still_present`

- `leaf_notification_body_default`
- `leaf_notification_textmode_cta_join`

Reason:

- `-` and `label: url` remain format shells rather than final user-ready copy

## Shell Only Not For Apply

### `shell_still_not_final`

- `leaf_free_style_quick`
- `leaf_free_style_coach`
- `leaf_free_style_checklist`
- `leaf_free_style_timeline`
- `leaf_free_style_weekend`
- `leaf_paid_conversation_format_shell`

Reason:

- current text still contains ellipsis or semantic shell placeholders and requires GPT re-authoring

### `policy_freeze_pending`

- `leaf_citypack_feedback_usage`

Reason:

- current text remains shell-like and the semantic meaning of `<内容>` is still unfrozen

## Mandatory Judgments

- `leaf_free_retrieval_empty_reply`
  - not `ready_literal_now`
  - promoted to `ready_after_binding_contract`
- `leaf_webhook_consent_state_ack`
  - promoted to `ready_after_variant_keying`
- `leaf_line_renderer_service_ack`
  - promoted to `ready_after_variant_keying`
- `leaf_region_prompt_or_validation`
  - promoted to `ready_after_variant_keying`
- `leaf_region_state_ack`
  - promoted to `ready_after_variant_keying`
- 16 test-anchor leaves
  - promoted to `ready_literal_now`
- `leaf_notification_body_default`
  - remains blocked
- `leaf_notification_textmode_cta_join`
  - remains blocked
