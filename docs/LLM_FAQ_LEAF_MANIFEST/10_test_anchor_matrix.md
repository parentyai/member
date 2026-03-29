# 10 Test Anchor Matrix

| leaf_id | current tests present? | exact string assert present? | route contract assert present? | output shape assert present? | missing test anchors | human review needed? |
| --- | --- | --- | --- | --- | --- | --- |
| leaf_faq_admin_disclaimer | yes | no | yes | yes | exact_string_assert, human_review_gate | yes |
| leaf_faq_admin_block_actions | yes | yes | yes | unknown | output_shape_assert, human_review_gate | yes |
| leaf_faq_admin_readiness_clarify | yes | no | unknown | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_faq_admin_readiness_refuse | yes | no | unknown | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_faq_admin_readiness_hedge | yes | no | unknown | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_faq_compat_disclaimer | yes | no | yes | yes | exact_string_assert, human_review_gate | yes |
| leaf_faq_compat_block_actions | yes | yes | yes | unknown | output_shape_assert, human_review_gate | yes |
| leaf_faq_compat_readiness_clarify | yes | no | unknown | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_faq_compat_readiness_refuse | yes | no | unknown | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_faq_compat_readiness_hedge | yes | no | unknown | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_free_retrieval_empty_reply | yes | no | yes | unknown | exact_string_assert, output_shape_assert | no |
| leaf_free_retrieval_ranked_reply | yes | no | yes | yes | exact_string_assert, human_review_gate | yes |
| leaf_free_style_quick | yes | yes | yes | unknown | output_shape_assert | no |
| leaf_free_style_coach | yes | no | yes | unknown | exact_string_assert, output_shape_assert | no |
| leaf_free_style_checklist | yes | no | yes | unknown | exact_string_assert, output_shape_assert | no |
| leaf_free_style_choice | yes | no | yes | unknown | exact_string_assert, output_shape_assert, human_review_gate | yes |
| leaf_free_style_debug | yes | no | yes | unknown | exact_string_assert, output_shape_assert, human_review_gate | yes |
| leaf_free_style_timeline | yes | no | yes | unknown | exact_string_assert, output_shape_assert | no |
| leaf_free_style_weekend | yes | no | yes | unknown | exact_string_assert, output_shape_assert | no |
| leaf_free_style_story | yes | no | yes | unknown | exact_string_assert, output_shape_assert, human_review_gate | yes |
| leaf_free_contextual_followup | yes | no | yes | unknown | exact_string_assert, output_shape_assert, human_review_gate | yes |
| leaf_paid_casual | yes | no | yes | unknown | exact_string_assert, output_shape_assert, human_review_gate | yes |
| leaf_paid_domain_concierge | yes | yes | yes | unknown | output_shape_assert, human_review_gate | yes |
| leaf_runtime_knowledge_fallback | yes | no | yes | unknown | exact_string_assert, output_shape_assert, human_review_gate | yes |
| leaf_paid_conversation_format_shell | yes | no | yes | unknown | exact_string_assert, output_shape_assert | no |
| leaf_paid_reply_guard_defaults | yes | yes | yes | unknown | output_shape_assert | no |
| leaf_paid_disclaimer | yes | no | yes | yes | exact_string_assert, human_review_gate | yes |
| leaf_paid_readiness_clarify_default | yes | no | unknown | no | exact_string_assert, route_contract_assert, output_shape_assert | no |
| leaf_paid_readiness_refuse_default | yes | no | unknown | no | exact_string_assert, route_contract_assert, output_shape_assert | no |
| leaf_paid_readiness_hedge_suffix | yes | no | unknown | no | exact_string_assert, route_contract_assert, output_shape_assert | no |
| leaf_paid_safety_core_facts_clarify | yes | no | yes | no | exact_string_assert, output_shape_assert, human_review_gate | yes |
| leaf_paid_verify_candidate_clarify | yes | no | yes | yes | exact_string_assert, human_review_gate | yes |
| leaf_paid_finalizer_fallback | yes | no | yes | unknown | exact_string_assert, output_shape_assert | no |
| leaf_paid_finalizer_clarify | yes | no | yes | yes | exact_string_assert, human_review_gate | yes |
| leaf_paid_finalizer_refuse | yes | no | yes | yes | exact_string_assert | no |
| leaf_webhook_guard_missing_reply_fallback | yes | no | yes | unknown | exact_string_assert, output_shape_assert | no |
| leaf_webhook_low_relevance_clarify | yes | no | yes | yes | exact_string_assert | no |
| leaf_webhook_retrieval_failure_fallback | yes | no | yes | unknown | exact_string_assert, output_shape_assert | no |
| leaf_webhook_readiness_clarify | yes | no | yes | yes | exact_string_assert | no |
| leaf_webhook_readiness_refuse | yes | no | yes | yes | exact_string_assert | no |
| leaf_webhook_synthetic_ack | yes | no | yes | yes | exact_string_assert | no |
| leaf_webhook_consent_state_ack | yes | no | yes | no | exact_string_assert, output_shape_assert | no |
| leaf_webhook_direct_command_ack | yes | unknown | yes | yes | exact_string_assert | no |
| leaf_welcome_message | yes | no | unknown | yes | exact_string_assert, route_contract_assert | no |
| leaf_line_renderer_overflow_summary | yes | no | unknown | yes | exact_string_assert, route_contract_assert | no |
| leaf_line_renderer_deeplink_with_url | yes | unknown | unknown | yes | exact_string_assert, route_contract_assert | no |
| leaf_line_renderer_deeplink_generic | yes | no | unknown | yes | exact_string_assert, route_contract_assert | no |
| leaf_line_renderer_service_ack | yes | no | unknown | yes | exact_string_assert, route_contract_assert | no |
| leaf_line_renderer_generic_headers | yes | no | unknown | yes | exact_string_assert, route_contract_assert, human_review_gate | yes |
| leaf_line_renderer_render_failure | yes | no | unknown | yes | exact_string_assert, route_contract_assert | no |
| leaf_notification_body_default | yes | no | unknown | yes | exact_string_assert, route_contract_assert | no |
| leaf_notification_alt_text_default | yes | yes | unknown | unknown | route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_notification_textmode_cta_join | yes | no | unknown | yes | exact_string_assert, route_contract_assert | no |
| leaf_region_prompt_or_validation | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert | no |
| leaf_region_state_ack | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert | no |
| leaf_citypack_feedback_received | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert | no |
| leaf_citypack_feedback_usage | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert | no |
| leaf_redac_membership_status | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_redac_membership_guidance | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_redac_membership_unavailable | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_journey_command_validation | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_journey_command_state_ack | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_journey_command_feature_paused | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_journey_command_support_open | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_journey_command_citypack_subscription | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_journey_command_todo_status | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_journey_command_guidance_hints | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_task_detail_defaults_isolate | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_task_flex_labels | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert | no |
| leaf_task_flex_buttons | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert | no |
| leaf_blocked_reason_labels | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_journey_reminder_message | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_adjacent_emergency_message | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_ops_escalation_title_isolate | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_ops_escalation_body_isolate | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_ops_escalation_button_isolate | no | no | no | no | exact_string_assert, route_contract_assert, output_shape_assert, human_review_gate | yes |
| leaf_policy_override_shadow | yes | no | yes | unknown | exact_string_assert, output_shape_assert, human_review_gate | yes |
| leaf_search_kb_replytext_shadow | yes | no | yes | unknown | exact_string_assert, output_shape_assert, human_review_gate | yes |
| leaf_paid_assistant_legacy_shadow | yes | yes | yes | unknown | output_shape_assert, human_review_gate | yes |
| leaf_future_quick_reply_surface_slot | no | unknown | unknown | unknown | runtime_observation, human_review_gate | yes |
