# 02 Generation Eligibility Report

- generation_mode: `SAFE_ONLY`
- eligible_generate: `35`
- deferred_review: `36`
- excluded_non_generate: `9`

## eligible_generate
| leaf_id | reason |
| --- | --- |
| `leaf_free_retrieval_empty_reply` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_free_style_quick` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_free_style_coach` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_free_style_checklist` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_free_style_timeline` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_free_style_weekend` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_paid_conversation_format_shell` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_paid_reply_guard_defaults` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_paid_readiness_clarify_default` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_paid_readiness_refuse_default` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_paid_readiness_hedge_suffix` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_paid_finalizer_fallback` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_paid_finalizer_refuse` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_webhook_guard_missing_reply_fallback` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_webhook_low_relevance_clarify` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_webhook_retrieval_failure_fallback` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_webhook_readiness_clarify` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_webhook_readiness_refuse` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_webhook_synthetic_ack` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_webhook_consent_state_ack` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_webhook_direct_command_ack` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_welcome_message` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_line_renderer_overflow_summary` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_line_renderer_deeplink_with_url` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_line_renderer_deeplink_generic` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_line_renderer_service_ack` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_line_renderer_render_failure` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_notification_body_default` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_notification_textmode_cta_join` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_region_prompt_or_validation` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_region_state_ack` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_citypack_feedback_received` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_citypack_feedback_usage` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_task_flex_labels` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |
| `leaf_task_flex_buttons` | end_user / leak=false / shape known / generation_allowed=true / human_review_required=false |

## deferred_review
| leaf_id | reason |
| --- | --- |
| `leaf_faq_admin_disclaimer` | audience is mixed |
| `leaf_faq_admin_block_actions` | audience is mixed |
| `leaf_faq_admin_readiness_clarify` | audience is mixed |
| `leaf_faq_admin_readiness_refuse` | audience is mixed |
| `leaf_faq_admin_readiness_hedge` | audience is mixed |
| `leaf_faq_compat_disclaimer` | audience is mixed |
| `leaf_faq_compat_block_actions` | audience is mixed |
| `leaf_faq_compat_readiness_clarify` | audience is mixed |
| `leaf_faq_compat_readiness_refuse` | audience is mixed |
| `leaf_faq_compat_readiness_hedge` | audience is mixed |
| `leaf_free_retrieval_ranked_reply` | human review gate present |
| `leaf_free_style_choice` | human review gate present |
| `leaf_free_style_debug` | human review gate present |
| `leaf_free_style_story` | human review gate present |
| `leaf_free_contextual_followup` | human review gate present |
| `leaf_paid_casual` | human review gate present |
| `leaf_paid_domain_concierge` | human review gate present |
| `leaf_runtime_knowledge_fallback` | human review gate present |
| `leaf_paid_disclaimer` | human review gate present |
| `leaf_paid_safety_core_facts_clarify` | human review gate present |
| `leaf_paid_verify_candidate_clarify` | human review gate present |
| `leaf_paid_finalizer_clarify` | human review gate present |
| `leaf_line_renderer_generic_headers` | human review gate present |
| `leaf_notification_alt_text_default` | output shape is unknown_shape |
| `leaf_redac_membership_status` | human review gate present |
| `leaf_redac_membership_guidance` | human review gate present |
| `leaf_redac_membership_unavailable` | human review gate present |
| `leaf_journey_command_validation` | human review gate present |
| `leaf_journey_command_state_ack` | human review gate present |
| `leaf_journey_command_feature_paused` | human review gate present |
| `leaf_journey_command_support_open` | human review gate present |
| `leaf_journey_command_citypack_subscription` | human review gate present |
| `leaf_journey_command_todo_status` | human review gate present |
| `leaf_journey_command_guidance_hints` | human review gate present |
| `leaf_blocked_reason_labels` | output shape is unknown_shape |
| `leaf_adjacent_emergency_message` | audience is mixed |

## excluded_non_generate
| leaf_id | reason |
| --- | --- |
| `leaf_task_detail_defaults_isolate` | isolate_for_human_or_separate_policy leaf |
| `leaf_journey_reminder_message` | isolate_for_human_or_separate_policy leaf |
| `leaf_ops_escalation_title_isolate` | isolate_for_human_or_separate_policy leaf |
| `leaf_ops_escalation_body_isolate` | isolate_for_human_or_separate_policy leaf |
| `leaf_ops_escalation_button_isolate` | isolate_for_human_or_separate_policy leaf |
| `leaf_policy_override_shadow` | shadow or dead/test-only leaf |
| `leaf_search_kb_replytext_shadow` | shadow or dead/test-only leaf |
| `leaf_paid_assistant_legacy_shadow` | shadow or dead/test-only leaf |
| `leaf_future_quick_reply_surface_slot` | unknown future surface slot |

