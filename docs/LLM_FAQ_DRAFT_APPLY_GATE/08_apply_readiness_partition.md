# 08 Apply Readiness Partition

## Content-Level Triage Classes
- `literal_apply_candidate = 16`
- `parameterized_apply_candidate = 3`
- `keyed_variant_candidate = 7`
- `copy_shell_only = 7`
- `blocked_apply = 2`

## Final Apply Readiness Partition
- `ready_literal_now = 0`
- `ready_after_binding_contract = 1`
- `ready_after_variant_keying = 0`
- `shell_only_not_for_apply = 7`
- `blocked_apply = 27`

| leaf_id | apply_class | final_partition | output_shape | primary_route | unresolved_tokens | variant_keys_needed | blocking_reasons |
| --- | --- | --- | --- | --- | --- | --- | --- |
| leaf_citypack_feedback_received | literal_apply_candidate | blocked_apply | command_ack | journey direct command parser |  |  | weak_test_anchor |
| leaf_citypack_feedback_usage | copy_shell_only | shell_only_not_for_apply | clarify_prompt | journey direct command parser | <内容> |  | missing_binding_source ,  shell_only ,  unresolved_placeholder |
| leaf_free_retrieval_empty_reply | parameterized_apply_candidate | blocked_apply | fallback_text | POST /webhook/line free retrieval | <title> |  | binding_contract_required ,  unresolved_placeholder ,  weak_test_anchor |
| leaf_free_style_checklist | copy_shell_only | shell_only_not_for_apply | plain_text_answer | POST /webhook/line free retrieval | ... |  | ellipsis_placeholder ,  runtime_semantic_fill_required ,  shell_only |
| leaf_free_style_coach | copy_shell_only | shell_only_not_for_apply | plain_text_answer | POST /webhook/line free retrieval | ... |  | ellipsis_placeholder ,  runtime_semantic_fill_required ,  shell_only |
| leaf_free_style_quick | copy_shell_only | shell_only_not_for_apply | plain_text_answer | POST /webhook/line free retrieval | ... |  | ellipsis_placeholder ,  runtime_semantic_fill_required ,  shell_only |
| leaf_free_style_timeline | copy_shell_only | shell_only_not_for_apply | plain_text_answer | POST /webhook/line free retrieval | ... |  | ellipsis_placeholder ,  runtime_semantic_fill_required ,  shell_only |
| leaf_free_style_weekend | copy_shell_only | shell_only_not_for_apply | plain_text_answer | POST /webhook/line free retrieval | ... |  | ellipsis_placeholder ,  runtime_semantic_fill_required ,  shell_only |
| leaf_line_renderer_deeplink_generic | literal_apply_candidate | blocked_apply | renderer_default_text | renderer fallback |  |  | weak_test_anchor |
| leaf_line_renderer_deeplink_with_url | parameterized_apply_candidate | blocked_apply | renderer_default_text | renderer fallback | <url> |  | binding_contract_required ,  weak_contract ,  weak_test_anchor |
| leaf_line_renderer_overflow_summary | literal_apply_candidate | blocked_apply | renderer_default_text | renderer fallback |  |  | weak_test_anchor |
| leaf_line_renderer_render_failure | literal_apply_candidate | blocked_apply | renderer_default_text | renderer fallback |  |  | weak_test_anchor |
| leaf_line_renderer_service_ack | keyed_variant_candidate | blocked_apply | renderer_default_text | renderer fallback |  | service_ack_wait ,  service_ack_prepare ,  service_ack_display | keyed_variant_missing ,  mixed_state_text ,  weak_test_anchor |
| leaf_notification_body_default | blocked_apply | blocked_apply | notification_text | notification sender | - |  | format_placeholder_only ,  weak_contract ,  weak_test_anchor |
| leaf_notification_textmode_cta_join | blocked_apply | blocked_apply | notification_text | notification sender | label: url |  | format_placeholder_only ,  weak_contract ,  weak_test_anchor |
| leaf_paid_conversation_format_shell | copy_shell_only | shell_only_not_for_apply | plain_text_answer | POST /webhook/line paid finalization | <pitfall> ,  <gap> |  | runtime_semantic_fill_required ,  shell_only |
| leaf_paid_finalizer_fallback | literal_apply_candidate | blocked_apply | fallback_text | paid orchestrator |  |  | weak_test_anchor |
| leaf_paid_finalizer_refuse | literal_apply_candidate | blocked_apply | refuse_text | paid orchestrator |  |  | weak_test_anchor |
| leaf_paid_readiness_clarify_default | literal_apply_candidate | blocked_apply | clarify_prompt | paid orchestrator |  |  | weak_test_anchor |
| leaf_paid_readiness_hedge_suffix | literal_apply_candidate | blocked_apply | disclaimer_block | paid orchestrator |  |  | weak_test_anchor |
| leaf_paid_readiness_refuse_default | literal_apply_candidate | blocked_apply | refuse_text | paid orchestrator |  |  | weak_test_anchor |
| leaf_paid_reply_guard_defaults | parameterized_apply_candidate | ready_after_binding_contract | fallback_text | POST /webhook/line paid finalization | <pitfall> |  | binding_contract_required |
| leaf_region_prompt_or_validation | keyed_variant_candidate | blocked_apply | clarify_prompt | journey direct command parser |  | prompt_required ,  invalid_format | keyed_variant_missing ,  mixed_state_text ,  weak_contract ,  weak_test_anchor |
| leaf_region_state_ack | keyed_variant_candidate | blocked_apply | command_ack | journey direct command parser | <cityLabel> ,  <stateLabel> | declared ,  already_set | keyed_variant_missing ,  mixed_state_text ,  weak_contract ,  weak_test_anchor |
| leaf_task_flex_buttons | keyed_variant_candidate | blocked_apply | flex_button_set | journey task detail and postback |  | manual_button ,  video_button ,  mistake_button ,  external_link_button | keyed_variant_missing ,  mixed_state_text ,  weak_contract ,  weak_test_anchor |
| leaf_task_flex_labels | keyed_variant_candidate | blocked_apply | flex_label_set | journey task detail and postback | <title> | section_why_now ,  section_duration ,  section_checklist ,  section_summary ,  section_top_mistakes ,  section_context_tips ,  section_understanding ,  hero_title ,  alt_text_title | keyed_variant_missing ,  mixed_state_text ,  weak_contract ,  weak_test_anchor |
| leaf_webhook_consent_state_ack | keyed_variant_candidate | blocked_apply | consent_ack | POST /webhook/line top-level |  | consent_granted ,  consent_revoked | keyed_variant_missing ,  mixed_state_text ,  weak_test_anchor |
| leaf_webhook_direct_command_ack | keyed_variant_candidate | blocked_apply | command_ack | POST /webhook/line top-level | <phaseCommand> ,  <doneKey> | phase_update ,  done_update | keyed_variant_missing ,  mixed_state_text ,  weak_test_anchor |
| leaf_webhook_guard_missing_reply_fallback | literal_apply_candidate | blocked_apply | fallback_text | POST /webhook/line top-level |  |  | weak_test_anchor |
| leaf_webhook_low_relevance_clarify | literal_apply_candidate | blocked_apply | clarify_prompt | POST /webhook/line top-level |  |  | weak_test_anchor |
| leaf_webhook_readiness_clarify | literal_apply_candidate | blocked_apply | clarify_prompt | POST /webhook/line top-level |  |  | weak_test_anchor |
| leaf_webhook_readiness_refuse | literal_apply_candidate | blocked_apply | refuse_text | POST /webhook/line top-level |  |  | weak_test_anchor |
| leaf_webhook_retrieval_failure_fallback | literal_apply_candidate | blocked_apply | fallback_text | POST /webhook/line top-level |  |  | weak_test_anchor |
| leaf_webhook_synthetic_ack | literal_apply_candidate | blocked_apply | command_ack | POST /webhook/line top-level |  |  | weak_test_anchor |
| leaf_welcome_message | literal_apply_candidate | blocked_apply | welcome_text | welcome push flow |  |  | weak_test_anchor |

## Notes
- `draft_ready` であっても exact-string anchor が弱いものは `ready_literal_now` に上げていません。
- `leaf_paid_reply_guard_defaults` のみ、token source が観測済みかつ exact string anchor があるため `ready_after_binding_contract` としました。
