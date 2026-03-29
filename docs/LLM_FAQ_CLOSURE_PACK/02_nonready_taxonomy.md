# 02 Non-Ready Taxonomy

35 generated drafts の non-ready 要因を blocker taxonomy で再分類しました。

- `binding_missing_only`: `2`
- `variant_key_missing_only`: `4`
- `binding_and_variant_missing`: `3`
- `shell_requires_reauthoring`: `6`
- `format_placeholder_only`: `2`
- `weak_exact_string_anchor`: `17`
- `mixed_blocker`: `1`

| leaf_id | current_apply_class | final_partition | closure_class | primary_blocker | all_blockers |
| --- | --- | --- | --- | --- | --- |
| leaf_citypack_feedback_received | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor ,  weak_output_shape_anchor ,  weak_route_contract_anchor |
| leaf_citypack_feedback_usage | copy_shell_only | shell_only_not_for_apply | human_policy_freeze_required | mixed_blocker | mixed_blocker ,  weak_exact_string_anchor ,  weak_output_shape_anchor ,  weak_route_contract_anchor ,  binding_missing_only |
| leaf_free_retrieval_empty_reply | parameterized_apply_candidate | blocked_apply | codex_binding_closure_candidate | binding_missing_only | binding_missing_only ,  weak_exact_string_anchor ,  weak_output_shape_anchor |
| leaf_free_style_checklist | copy_shell_only | shell_only_not_for_apply | gpt_reauthoring_required | shell_requires_reauthoring | shell_requires_reauthoring ,  weak_exact_string_anchor ,  weak_output_shape_anchor |
| leaf_free_style_coach | copy_shell_only | shell_only_not_for_apply | gpt_reauthoring_required | shell_requires_reauthoring | shell_requires_reauthoring ,  weak_exact_string_anchor ,  weak_output_shape_anchor |
| leaf_free_style_quick | copy_shell_only | shell_only_not_for_apply | gpt_reauthoring_required | shell_requires_reauthoring | shell_requires_reauthoring ,  weak_output_shape_anchor |
| leaf_free_style_timeline | copy_shell_only | shell_only_not_for_apply | gpt_reauthoring_required | shell_requires_reauthoring | shell_requires_reauthoring ,  weak_exact_string_anchor ,  weak_output_shape_anchor |
| leaf_free_style_weekend | copy_shell_only | shell_only_not_for_apply | gpt_reauthoring_required | shell_requires_reauthoring | shell_requires_reauthoring ,  weak_exact_string_anchor ,  weak_output_shape_anchor |
| leaf_line_renderer_deeplink_generic | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor ,  weak_route_contract_anchor |
| leaf_line_renderer_deeplink_with_url | parameterized_apply_candidate | blocked_apply | human_policy_freeze_required | weak_exact_string_anchor | weak_exact_string_anchor ,  binding_missing_only ,  weak_route_contract_anchor |
| leaf_line_renderer_overflow_summary | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor ,  weak_route_contract_anchor |
| leaf_line_renderer_render_failure | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor ,  weak_route_contract_anchor |
| leaf_line_renderer_service_ack | keyed_variant_candidate | blocked_apply | codex_variant_closure_candidate | variant_key_missing_only | variant_key_missing_only ,  weak_exact_string_anchor ,  weak_route_contract_anchor |
| leaf_notification_body_default | blocked_apply | blocked_apply | human_policy_freeze_required | format_placeholder_only | format_placeholder_only ,  weak_exact_string_anchor ,  weak_route_contract_anchor |
| leaf_notification_textmode_cta_join | blocked_apply | blocked_apply | human_policy_freeze_required | format_placeholder_only | format_placeholder_only ,  weak_exact_string_anchor ,  weak_route_contract_anchor |
| leaf_paid_conversation_format_shell | copy_shell_only | shell_only_not_for_apply | gpt_reauthoring_required | shell_requires_reauthoring | shell_requires_reauthoring ,  weak_exact_string_anchor ,  weak_output_shape_anchor |
| leaf_paid_finalizer_fallback | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor ,  weak_output_shape_anchor |
| leaf_paid_finalizer_refuse | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor |
| leaf_paid_readiness_clarify_default | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor ,  weak_output_shape_anchor ,  weak_route_contract_anchor |
| leaf_paid_readiness_hedge_suffix | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor ,  weak_output_shape_anchor ,  weak_route_contract_anchor |
| leaf_paid_readiness_refuse_default | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor ,  weak_output_shape_anchor ,  weak_route_contract_anchor |
| leaf_paid_reply_guard_defaults | parameterized_apply_candidate | ready_after_binding_contract | human_policy_freeze_required | binding_missing_only | binding_missing_only ,  weak_output_shape_anchor |
| leaf_region_prompt_or_validation | keyed_variant_candidate | blocked_apply | codex_variant_closure_candidate | variant_key_missing_only | variant_key_missing_only ,  weak_exact_string_anchor ,  weak_output_shape_anchor ,  weak_route_contract_anchor |
| leaf_region_state_ack | keyed_variant_candidate | blocked_apply | codex_variant_closure_candidate | binding_and_variant_missing | binding_and_variant_missing ,  weak_exact_string_anchor ,  weak_output_shape_anchor ,  weak_route_contract_anchor |
| leaf_task_flex_buttons | keyed_variant_candidate | blocked_apply | human_policy_freeze_required | variant_key_missing_only | variant_key_missing_only ,  weak_exact_string_anchor ,  weak_output_shape_anchor ,  weak_route_contract_anchor |
| leaf_task_flex_labels | keyed_variant_candidate | blocked_apply | human_policy_freeze_required | binding_and_variant_missing | binding_and_variant_missing ,  weak_exact_string_anchor ,  weak_output_shape_anchor ,  weak_route_contract_anchor |
| leaf_webhook_consent_state_ack | keyed_variant_candidate | blocked_apply | codex_variant_closure_candidate | variant_key_missing_only | variant_key_missing_only ,  weak_exact_string_anchor ,  weak_output_shape_anchor |
| leaf_webhook_direct_command_ack | keyed_variant_candidate | blocked_apply | human_policy_freeze_required | binding_and_variant_missing | binding_and_variant_missing ,  weak_exact_string_anchor |
| leaf_webhook_guard_missing_reply_fallback | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor ,  weak_output_shape_anchor |
| leaf_webhook_low_relevance_clarify | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor |
| leaf_webhook_readiness_clarify | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor |
| leaf_webhook_readiness_refuse | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor |
| leaf_webhook_retrieval_failure_fallback | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor ,  weak_output_shape_anchor |
| leaf_webhook_synthetic_ack | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor |
| leaf_welcome_message | literal_apply_candidate | blocked_apply | codex_test_anchor_closure_candidate | weak_exact_string_anchor | weak_exact_string_anchor ,  weak_route_contract_anchor |
