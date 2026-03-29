# 02 Fact Freeze Recap

- repo_head: `834eaf010876a6c08d21efd38a0e135df7987cb4`
- repo_branch: `DETACHED`
- raw families (G0): `32`
- runtime lanes (G1): `12`
- canonical owners (G2): `14`
- GPT handoff units (G3): `20`
- future registry groups (G4): `17`

## G3 units
| unit_id | source families | route scope | audience | safety | surface | parent G4 hints |
| --- | --- | --- | --- | --- | --- | --- |
| g3_faq_admin_answer_unit | faq_disclaimer_templates, faq_block_action_labels, answer_readiness_gate_templates | POST /api/admin/llm/faq/answer | mixed | mixed | http_json, line_text | g4_faq_admin_registry_slot, g4_faq_compat_registry_slot, g4_assistant_paid_safety_registry_slot |
| g3_faq_compat_answer_unit | faq_disclaimer_templates, faq_block_action_labels, answer_readiness_gate_templates | POST /api/phaseLLM4/faq/answer | mixed | mixed | http_json, line_text | g4_faq_admin_registry_slot, g4_faq_compat_registry_slot, g4_assistant_paid_safety_registry_slot |
| g3_free_retrieval_search_unit | free_retrieval_empty_reply, free_retrieval_ranked_reply, response_style_templates | POST /webhook/line free retrieval branch | end_user | mixed | line_text | g4_assistant_free_retrieval_registry_slot |
| g3_free_contextual_followup_unit | free_contextual_followup_domain_answers | POST /webhook/line free contextual followup | end_user | faq | line_text | g4_assistant_free_contextual_registry_slot |
| g3_paid_casual_unit | paid_casual_templates | POST /webhook/line paid casual | end_user | fallback | line_text | g4_assistant_paid_casual_registry_slot |
| g3_paid_domain_answer_unit | paid_domain_concierge_templates, runtime_knowledge_fallback_templates | POST /webhook/line paid domain branch | end_user | mixed | line_text | g4_assistant_paid_domain_registry_slot |
| g3_paid_conversation_format_unit | paid_assistant_conversation_format, paid_reply_guard_defaults | POST /webhook/line paid finalization | end_user | mixed | line_text | g4_assistant_paid_format_registry_slot |
| g3_paid_disclaimer_unit | faq_disclaimer_templates | POST /webhook/line paid assistant | end_user | disclaimer | http_json | g4_faq_admin_registry_slot, g4_faq_compat_registry_slot, g4_assistant_paid_safety_registry_slot |
| g3_paid_safety_gate_unit | answer_readiness_gate_templates, required_core_facts_domain_clarify, verify_candidate_clarify_templates, finalize_candidate_fallback_templates | paid orchestrator and shared readiness path | mixed | mixed | line_text | g4_faq_admin_registry_slot, g4_faq_compat_registry_slot, g4_assistant_paid_safety_registry_slot |
| g3_webhook_top_level_unit | webhook_assistant_top_level_templates | POST /webhook/line top-level | end_user | fallback | line_text | g4_webhook_top_level_registry_slot |
| g3_welcome_message_unit | welcome_message | welcome push flow | end_user | notification | line_text | g4_notification_registry_slot |
| g3_line_renderer_service_fallback_unit | line_surface_renderer_defaults | renderer fallback | end_user | fallback | line_text, line_template, line_flex | g4_line_renderer_fallback_registry_slot |
| g3_notification_renderer_unit | notification_renderer_defaults | notification sender | end_user | cta | line_text, line_template_buttons | g4_notification_registry_slot |
| g3_journey_direct_command_unit | region_line_messages, citypack_feedback_messages, redac_membership_messages, journey_command_replies | journey direct command parser | end_user | mixed | line_text | g4_journey_text_registry_slot |
| g3_journey_task_surface_unit | journey_task_detail_defaults, task_flex_labels_and_buttons, blocked_reason_labels | journey task detail and postback | end_user | mixed | line_text, line_flex, line_text_or_ui_label | g4_journey_task_registry_slot |
| g3_journey_reminder_unit | journey_reminder_message | internal reminder jobs | end_user | notification | line_text | g4_notification_registry_slot |
| g3_adjacent_emergency_unit | emergency_message_template | internal emergency jobs | mixed | warning | notification_or_line_text | g4_adjacent_ops_registry_slot |
| g3_adjacent_ops_notification_unit | ops_escalation_default_notification | phase33 ops decision execute | mixed | cta | notification | g4_adjacent_ops_registry_slot |
| g3_policy_override_shadow_unit | policy_override_disclaimer_templates | ops config policy path | operator | disclaimer | http_json_and_line_if_override_active | g4_policy_shadow_registry_slot |
| g3_dead_shadow_unit | search_kb_replytext_templates, paid_assistant_legacy_structured_format | not observed on live default route | unknown | faq | line_text | g4_dead_shadow_registry_slot |

## G4 groups
| group_id | source families | owner | merge policy |
| --- | --- | --- | --- |
| g4_faq_admin_registry_slot | faq_disclaimer_templates, faq_block_action_labels, answer_readiness_gate_templates | g2_faq_http_owner | hard_no_merge |
| g4_faq_compat_registry_slot | faq_disclaimer_templates, faq_block_action_labels, answer_readiness_gate_templates | g2_faq_http_owner | hard_no_merge |
| g4_assistant_free_retrieval_registry_slot | free_retrieval_empty_reply, free_retrieval_ranked_reply, response_style_templates | g2_assistant_free_owner | hard_no_merge |
| g4_assistant_free_contextual_registry_slot | free_contextual_followup_domain_answers | g2_assistant_free_owner | hard_no_merge |
| g4_assistant_paid_casual_registry_slot | paid_casual_templates | g2_assistant_paid_casual_owner | hard_no_merge |
| g4_assistant_paid_domain_registry_slot | paid_domain_concierge_templates, runtime_knowledge_fallback_templates | g2_assistant_paid_domain_owner | hard_no_merge |
| g4_assistant_paid_format_registry_slot | paid_assistant_conversation_format, paid_reply_guard_defaults | g2_assistant_paid_format_owner | hard_no_merge |
| g4_assistant_paid_safety_registry_slot | answer_readiness_gate_templates, required_core_facts_domain_clarify, verify_candidate_clarify_templates, finalize_candidate_fallback_templates, faq_disclaimer_templates | g2_assistant_paid_safety_owner | hard_no_merge |
| g4_webhook_top_level_registry_slot | webhook_assistant_top_level_templates | g2_webhook_top_level_owner | hard_no_merge |
| g4_journey_text_registry_slot | region_line_messages, citypack_feedback_messages, redac_membership_messages, journey_command_replies | g2_journey_task_owner | hard_no_merge |
| g4_journey_task_registry_slot | journey_task_detail_defaults, task_flex_labels_and_buttons, blocked_reason_labels | g2_journey_task_owner | hard_no_merge |
| g4_notification_registry_slot | welcome_message, notification_renderer_defaults, journey_reminder_message | g2_notification_owner | hard_no_merge |
| g4_line_renderer_fallback_registry_slot | line_surface_renderer_defaults | g2_line_renderer_default_owner | hard_no_merge |
| g4_adjacent_ops_registry_slot | emergency_message_template, ops_escalation_default_notification | g2_adjacent_ops_owner | hard_no_merge |
| g4_policy_shadow_registry_slot | policy_override_disclaimer_templates | g2_policy_override_owner | shadow_only |
| g4_dead_shadow_registry_slot | search_kb_replytext_templates, paid_assistant_legacy_structured_format | g2_shadow_not_live_owner | shadow_only |
| g4_dynamic_quick_reply_surface_slot |  | unknown | shadow_only |

## Shadow units
- `unit_policy_override_shadow`
- `unit_dead_shadow`

## Leak candidates
- `journey_task_detail_defaults`
- `journey_reminder_message`
- `ops_escalation_default_notification`
- `policy_override_disclaimer_templates`
