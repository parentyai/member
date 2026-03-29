# 04 Runtime Lane Groups

| Lane | Included families | Primary routes | Audience | Merge policy | Notes |
| --- | --- | --- | --- | --- | --- |
| faq_admin_runtime | faq_disclaimer_templates \| faq_block_action_labels \| answer_readiness_gate_templates | POST /api/admin/llm/faq/answer | mixed | hard_no_merge | Uses same disclaimer family as compat and paid paths but route responsibility remains admin FAQ. |
| faq_compat_runtime | faq_disclaimer_templates \| faq_block_action_labels \| answer_readiness_gate_templates | POST /api/phaseLLM4/faq/answer | mixed | hard_no_merge | Same copy can converge but route attribution must stay explicit. |
| line_free_retrieval_runtime | free_retrieval_empty_reply \| free_retrieval_ranked_reply \| response_style_templates \| free_contextual_followup_domain_answers | POST /webhook/line | end_user | hard_no_merge | Free retrieval ranked and empty flows stay in one lane, but direct-answer overlap with paid domain remains a no-merge boundary. |
| line_paid_casual_runtime | paid_casual_templates | POST /webhook/line | end_user | hard_no_merge | Do not collapse casual reassurance with domain answer or safety clarifications. |
| line_paid_domain_runtime | paid_domain_concierge_templates \| paid_assistant_conversation_format \| runtime_knowledge_fallback_templates | POST /webhook/line | end_user | hard_no_merge | Formatting wrapper and fallback slices are coupled to domain answer lane but remain separate owner groups. |
| paid_safety_layers_runtime | faq_disclaimer_templates \| paid_reply_guard_defaults \| answer_readiness_gate_templates \| required_core_facts_domain_clarify \| verify_candidate_clarify_templates \| finalize_candidate_fallback_templates \| runtime_knowledge_fallback_templates | POST /webhook/line \| POST /api/admin/llm/faq/answer \| POST /api/phaseLLM4/faq/answer | mixed | hard_no_merge | Intentional redundancy lives here. Same copy cannot justify merging clarify, refuse, disclaimer, and generic fallback across decision layers. |
| webhook_top_level_runtime | webhook_assistant_top_level_templates \| welcome_message | POST /webhook/line | end_user | hard_no_merge | Mixed acknowledgements and safety fallback make this lane low-registry-readiness until families are split further in a future add-only step. |
| task_journey_runtime | journey_command_replies \| journey_task_detail_defaults \| task_flex_labels_and_buttons \| region_line_messages \| citypack_feedback_messages \| redac_membership_messages \| blocked_reason_labels | POST /webhook/line | end_user | hard_no_merge | Keep command text, task detail defaults, and blocked labels traceable even when wording converges. |
| reminder_notification_runtime | journey_reminder_message \| notification_renderer_defaults \| line_surface_renderer_defaults | internal reminder jobs \| notification sender flows | end_user | hard_no_merge | Notification CTA, reminder copy, and renderer fallback share outbound surface but remain distinct G3 units. |
| adjacent_emergency_ops_runtime | emergency_message_template \| ops_escalation_default_notification | internal emergency jobs \| phase33 ops decision execute | mixed | hard_no_merge | Treat as adjacent runtime, not assistant runtime. |
| policy_shadow_runtime | policy_override_disclaimer_templates | ops config policy set and status | operator | shadow_only | Special shadow class mandated by the request. |
| dead_test_shadow_runtime | search_kb_replytext_templates \| paid_assistant_legacy_structured_format | not observed on current live default runtime | unknown | shadow_only | Special shadow class mandated by the request. |

## Lane Notes

- `policy_shadow_runtime` is scoped to policy override seed behavior only. It is not treated as an active FAQ admin or compat lane.
- `dead_test_shadow_runtime` preserves families that are not on the current live default path.
- `adjacent_emergency_ops_runtime` is explicitly separate from main assistant runtime.
- `webhook_top_level_runtime` remains mixed and therefore low registry readiness.
