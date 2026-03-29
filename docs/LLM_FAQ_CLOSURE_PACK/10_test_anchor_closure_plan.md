# 10 Test Anchor Closure Plan

test anchor records: `86`

| leaf_id | anchor_type | depends_on_binding_freeze | depends_on_variant_freeze | depends_on_reauthoring | expected_observed_contract |
| --- | --- | --- | --- | --- | --- |
| leaf_free_retrieval_empty_reply | exact_string_anchor | true | false | false | POST /webhook/line free retrieval |
| leaf_free_retrieval_empty_reply | output_shape_anchor | true | false | false | POST /webhook/line free retrieval |
| leaf_free_retrieval_empty_reply | binding_contract_anchor | true | false | false | question -> normalizeText(question) |
| leaf_free_style_quick | output_shape_anchor | false | false | true | POST /webhook/line free retrieval |
| leaf_free_style_coach | exact_string_anchor | false | false | true | POST /webhook/line free retrieval |
| leaf_free_style_coach | output_shape_anchor | false | false | true | POST /webhook/line free retrieval |
| leaf_free_style_checklist | exact_string_anchor | false | false | true | POST /webhook/line free retrieval |
| leaf_free_style_checklist | output_shape_anchor | false | false | true | POST /webhook/line free retrieval |
| leaf_free_style_timeline | exact_string_anchor | false | false | true | POST /webhook/line free retrieval |
| leaf_free_style_timeline | output_shape_anchor | false | false | true | POST /webhook/line free retrieval |
| leaf_free_style_weekend | exact_string_anchor | false | false | true | POST /webhook/line free retrieval |
| leaf_free_style_weekend | output_shape_anchor | false | false | true | POST /webhook/line free retrieval |
| leaf_paid_conversation_format_shell | exact_string_anchor | true | false | true | POST /webhook/line paid finalization |
| leaf_paid_conversation_format_shell | output_shape_anchor | true | false | true | POST /webhook/line paid finalization |
| leaf_paid_conversation_format_shell | binding_contract_anchor | true | false | true | gaps[0] / followupQuestion, risks[0] or gaps[0] |
| leaf_paid_reply_guard_defaults | output_shape_anchor | true | false | false | POST /webhook/line paid finalization |
| leaf_paid_reply_guard_defaults | binding_contract_anchor | true | false | false | payload.pitfall via pickPitfallLine() |
| leaf_paid_readiness_clarify_default | exact_string_anchor | false | false | false | paid orchestrator |
| leaf_paid_readiness_clarify_default | route_contract_anchor | false | false | false | paid orchestrator |
| leaf_paid_readiness_clarify_default | output_shape_anchor | false | false | false | paid orchestrator |
| leaf_paid_readiness_refuse_default | exact_string_anchor | false | false | false | paid orchestrator |
| leaf_paid_readiness_refuse_default | route_contract_anchor | false | false | false | paid orchestrator |
| leaf_paid_readiness_refuse_default | output_shape_anchor | false | false | false | paid orchestrator |
| leaf_paid_readiness_hedge_suffix | exact_string_anchor | false | false | false | paid orchestrator |
| leaf_paid_readiness_hedge_suffix | route_contract_anchor | false | false | false | paid orchestrator |
| leaf_paid_readiness_hedge_suffix | output_shape_anchor | false | false | false | paid orchestrator |
| leaf_paid_finalizer_fallback | exact_string_anchor | false | false | false | paid orchestrator |
| leaf_paid_finalizer_fallback | output_shape_anchor | false | false | false | paid orchestrator |
| leaf_paid_finalizer_refuse | exact_string_anchor | false | false | false | paid orchestrator |
| leaf_webhook_guard_missing_reply_fallback | exact_string_anchor | false | false | false | POST /webhook/line top-level |
| leaf_webhook_guard_missing_reply_fallback | output_shape_anchor | false | false | false | POST /webhook/line top-level |
| leaf_webhook_low_relevance_clarify | exact_string_anchor | false | false | false | POST /webhook/line top-level |
| leaf_webhook_retrieval_failure_fallback | exact_string_anchor | false | false | false | POST /webhook/line top-level |
| leaf_webhook_retrieval_failure_fallback | output_shape_anchor | false | false | false | POST /webhook/line top-level |
| leaf_webhook_readiness_clarify | exact_string_anchor | false | false | false | POST /webhook/line top-level |
| leaf_webhook_readiness_refuse | exact_string_anchor | false | false | false | POST /webhook/line top-level |
| leaf_webhook_synthetic_ack | exact_string_anchor | false | false | false | POST /webhook/line top-level |
| leaf_webhook_consent_state_ack | exact_string_anchor | false | true | false | POST /webhook/line top-level |
| leaf_webhook_consent_state_ack | output_shape_anchor | false | true | false | POST /webhook/line top-level |
| leaf_webhook_consent_state_ack | variant_key_anchor | false | true | false | consent_granted, consent_revoked |
| leaf_webhook_direct_command_ack | exact_string_anchor | true | true | false | POST /webhook/line top-level |
| leaf_webhook_direct_command_ack | binding_contract_anchor | true | true | false | parseJourneyPhaseCommand(text), parseNextActionCompletedCommand(text) |
| leaf_webhook_direct_command_ack | variant_key_anchor | true | true | false | phase_update, done_update |
| leaf_welcome_message | exact_string_anchor | false | false | false | welcome push flow |
| leaf_welcome_message | route_contract_anchor | false | false | false | welcome push flow |
| leaf_line_renderer_overflow_summary | exact_string_anchor | false | false | false | renderer fallback |
| leaf_line_renderer_overflow_summary | route_contract_anchor | false | false | false | renderer fallback |
| leaf_line_renderer_deeplink_with_url | exact_string_anchor | true | false | false | renderer fallback |
| leaf_line_renderer_deeplink_with_url | route_contract_anchor | true | false | false | renderer fallback |
| leaf_line_renderer_deeplink_with_url | binding_contract_anchor | true | false | false | payload.handoffUrl |
| leaf_line_renderer_deeplink_generic | exact_string_anchor | false | false | false | renderer fallback |
| leaf_line_renderer_deeplink_generic | route_contract_anchor | false | false | false | renderer fallback |
| leaf_line_renderer_service_ack | exact_string_anchor | false | true | false | renderer fallback |
| leaf_line_renderer_service_ack | route_contract_anchor | false | true | false | renderer fallback |
| leaf_line_renderer_service_ack | variant_key_anchor | false | true | false | service_ack_wait, service_ack_prepare, service_ack_display |
| leaf_line_renderer_render_failure | exact_string_anchor | false | false | false | renderer fallback |
| leaf_line_renderer_render_failure | route_contract_anchor | false | false | false | renderer fallback |
| leaf_notification_body_default | exact_string_anchor | false | false | false | notification sender |
| leaf_notification_body_default | route_contract_anchor | false | false | false | notification sender |
| leaf_notification_textmode_cta_join | exact_string_anchor | false | false | false | notification sender |
| leaf_notification_textmode_cta_join | route_contract_anchor | false | false | false | notification sender |
| leaf_region_prompt_or_validation | exact_string_anchor | false | true | false | journey direct command parser |
| leaf_region_prompt_or_validation | route_contract_anchor | false | true | false | journey direct command parser |
| leaf_region_prompt_or_validation | output_shape_anchor | false | true | false | journey direct command parser |
| leaf_region_prompt_or_validation | variant_key_anchor | false | true | false | prompt_required, invalid_format |
| leaf_region_state_ack | exact_string_anchor | true | true | false | journey direct command parser |
| leaf_region_state_ack | route_contract_anchor | true | true | false | journey direct command parser |
| leaf_region_state_ack | output_shape_anchor | true | true | false | journey direct command parser |
| leaf_region_state_ack | binding_contract_anchor | true | true | false | regionDeclared(city, state) |
| leaf_region_state_ack | variant_key_anchor | true | true | false | declared, already_set |
| leaf_citypack_feedback_received | exact_string_anchor | false | false | false | journey direct command parser |
| leaf_citypack_feedback_received | route_contract_anchor | false | false | false | journey direct command parser |
| leaf_citypack_feedback_received | output_shape_anchor | false | false | false | journey direct command parser |
| leaf_citypack_feedback_usage | exact_string_anchor | true | false | false | journey direct command parser |
| leaf_citypack_feedback_usage | route_contract_anchor | true | false | false | journey direct command parser |
| leaf_citypack_feedback_usage | output_shape_anchor | true | false | false | journey direct command parser |
| leaf_citypack_feedback_usage | binding_contract_anchor | true | false | false | not_observed |
| leaf_task_flex_labels | exact_string_anchor | true | true | false | journey task detail and postback |
| leaf_task_flex_labels | route_contract_anchor | true | true | false | journey task detail and postback |
| leaf_task_flex_labels | output_shape_anchor | true | true | false | journey task detail and postback |
| leaf_task_flex_labels | binding_contract_anchor | true | true | false | resolveTitle(task, taskContent) |
| leaf_task_flex_labels | variant_key_anchor | true | true | false | section_why_now, section_duration, section_checklist, section_summary, section_top_mistakes, section_context_tips, section_understanding, hero_title, alt_text_title |
| leaf_task_flex_buttons | exact_string_anchor | false | true | false | journey task detail and postback |
| leaf_task_flex_buttons | route_contract_anchor | false | true | false | journey task detail and postback |
| leaf_task_flex_buttons | output_shape_anchor | false | true | false | journey task detail and postback |
| leaf_task_flex_buttons | variant_key_anchor | false | true | false | manual_button, video_button, mistake_button, external_link_button |
