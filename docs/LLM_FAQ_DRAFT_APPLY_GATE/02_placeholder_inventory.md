# 02 Placeholder Inventory

generated 35 drafts の token / shell 観測を列挙します。

| token | appears_in_leaf | token_class | likely_binding_source | binding_source_observed | safe_default_exists | can_apply_without_binding |
| --- | --- | --- | --- | --- | --- | --- |
| <title> | leaf_free_retrieval_empty_reply | runtime_value_token | normalized question text | true | true | false |
| ... | leaf_free_style_quick | ellipsis_placeholder | not_observed | false | false | false |
| ... | leaf_free_style_coach | ellipsis_placeholder | not_observed | false | false | false |
| ... | leaf_free_style_checklist | ellipsis_placeholder | not_observed | false | false | false |
| ... | leaf_free_style_timeline | ellipsis_placeholder | not_observed | false | false | false |
| ... | leaf_free_style_weekend | ellipsis_placeholder | not_observed | false | false | false |
| <pitfall> | leaf_paid_conversation_format_shell | runtime_value_token | upstream semantic risk/pitfall line | true | false | false |
| <gap> | leaf_paid_conversation_format_shell | runtime_value_token | upstream semantic gap/followup line | true | false | false |
| <pitfall> | leaf_paid_reply_guard_defaults | runtime_value_token | paid reply guard pitfall line | true | true | false |
| <phaseCommand> | leaf_webhook_direct_command_ack | state_transition_token | parseJourneyPhaseCommand(text) | true | false | false |
| <doneKey> | leaf_webhook_direct_command_ack | state_transition_token | parseNextActionCompletedCommand(text) | true | false | false |
| <url> | leaf_line_renderer_deeplink_with_url | cta_url_token | renderer payload.handoffUrl | true | true | false |
| - | leaf_notification_body_default | format_placeholder | normalizeBody fallback when title/body empty | true | false | false |
| label: url | leaf_notification_textmode_cta_join | format_placeholder | cta.ctaText + cta.url text mode join | true | false | false |
| <cityLabel> | leaf_region_state_ack | ui_label_token | declared region city label | true | true | false |
| <stateLabel> | leaf_region_state_ack | ui_label_token | declared region state label | true | true | false |
| <内容> | leaf_citypack_feedback_usage | shell_placeholder | unknown user-input slot or literal format example | false | false | false |
| <title> | leaf_task_flex_labels | ui_label_token | resolved task title | true | true | false |

## Notes
- `...` は shell placeholder と扱い、final user copy と見なしません。
- bare `-` は notification body の normalize fallback であり、user-ready body ではありません。
- `label: url` は CTA text-mode join format であり、literal copy として apply しません。
