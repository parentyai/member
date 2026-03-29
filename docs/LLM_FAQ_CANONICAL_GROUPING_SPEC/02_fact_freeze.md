# 02 Fact Freeze

## Summary

- normalized_template_families: 32
- exact_text_blocks: 319
- runtime_truth_counts: reachable=15, conditionally_reachable=14, unconfirmed=1, dead_or_test_only=2
- type_counts: faq=10, fallback=9, warning=4, disclaimer=2, cta=3, button=2, quick_reply=0
- integrated_spec_crosswalk_available: yes

## Raw Family Freeze

| G0 family | template_kind | runtime_truth | primary lane | canonical owner | surface | special class |
| --- | --- | --- | --- | --- | --- | --- |
| faq_disclaimer_templates | disclaimer | reachable | g1_faq_admin_runtime \| g1_faq_compat_runtime \| g1_paid_safety_layers_runtime | g2_disclaimer_owner | http_json / faq_admin,faq_compat,paid_assistant | live |
| policy_override_disclaimer_templates | disclaimer | unconfirmed | g1_policy_shadow_runtime | g2_policy_override_owner | http_json_and_line_if_override_active / ops_config,admin_policy_editor | shadow_policy |
| faq_block_action_labels | cta | reachable | g1_faq_admin_runtime \| g1_faq_compat_runtime | g2_faq_http_owner | http_json / faq_admin,faq_compat,admin_ui | live |
| free_retrieval_empty_reply | faq | conditionally_reachable | g1_line_free_retrieval_runtime | g2_assistant_free_owner | line_text / assistant_free | live |
| free_retrieval_ranked_reply | faq | conditionally_reachable | g1_line_free_retrieval_runtime | g2_assistant_free_owner | line_text / assistant_free | live |
| search_kb_replytext_templates | faq | dead_or_test_only | g1_dead_test_shadow_runtime | g2_shadow_not_live_owner | not_observed / search helper | shadow_dead_test |
| response_style_templates | style | conditionally_reachable | g1_line_free_retrieval_runtime | g2_assistant_free_owner | line_text / assistant_free_and_paid_humanized | live |
| free_contextual_followup_domain_answers | faq | conditionally_reachable | g1_line_free_retrieval_runtime | g2_assistant_free_owner | line_text / assistant_free | live |
| paid_casual_templates | fallback | conditionally_reachable | g1_line_paid_casual_runtime | g2_assistant_paid_casual_owner | line_text / assistant_paid | live |
| paid_domain_concierge_templates | faq | conditionally_reachable | g1_line_paid_domain_runtime | g2_assistant_paid_domain_owner | line_text / assistant_paid | live |
| paid_assistant_conversation_format | faq | reachable | g1_line_paid_domain_runtime | g2_assistant_paid_format_owner | line_text / assistant_paid | live |
| paid_assistant_legacy_structured_format | faq | dead_or_test_only | g1_dead_test_shadow_runtime | g2_shadow_not_live_owner | line_text / assistant_paid | shadow_dead_test |
| paid_reply_guard_defaults | fallback | reachable | g1_paid_safety_layers_runtime | g2_assistant_paid_safety_owner | line_text / assistant_paid | live |
| answer_readiness_gate_templates | warning | reachable | g1_faq_admin_runtime \| g1_faq_compat_runtime \| g1_paid_safety_layers_runtime | g2_assistant_paid_safety_owner | line_text / assistant_paid,faq_http_json | live |
| required_core_facts_domain_clarify | warning | conditionally_reachable | g1_paid_safety_layers_runtime | g2_assistant_paid_safety_owner | line_text / assistant_paid | live |
| verify_candidate_clarify_templates | warning | conditionally_reachable | g1_paid_safety_layers_runtime | g2_assistant_paid_safety_owner | line_text / assistant_paid_orchestrator | live |
| finalize_candidate_fallback_templates | fallback | reachable | g1_paid_safety_layers_runtime | g2_assistant_paid_safety_owner | line_text / assistant_paid_orchestrator | live |
| runtime_knowledge_fallback_templates | fallback | conditionally_reachable | g1_line_paid_domain_runtime \| g1_paid_safety_layers_runtime | g2_assistant_paid_domain_owner | line_text / assistant_mixed | live |
| webhook_assistant_top_level_templates | fallback | reachable | g1_webhook_top_level_runtime | g2_webhook_top_level_owner | line_text / line_webhook | live |
| line_surface_renderer_defaults | fallback | conditionally_reachable | g1_reminder_notification_runtime | g2_line_renderer_default_owner | line_text,line_template,line_flex / line_renderer | live |
| welcome_message | notification | reachable | g1_webhook_top_level_runtime | g2_notification_owner | line_text / welcome_notification | live |
| notification_renderer_defaults | cta | conditionally_reachable | g1_reminder_notification_runtime | g2_notification_owner | line_text,line_template_buttons / notifications | live |
| region_line_messages | command_reply | reachable | g1_task_journey_runtime | g2_journey_task_owner | line_text / line_webhook_command | live |
| citypack_feedback_messages | command_reply | reachable | g1_task_journey_runtime | g2_journey_task_owner | line_text / line_webhook_command | live |
| redac_membership_messages | command_reply | reachable | g1_task_journey_runtime | g2_journey_task_owner | line_text / line_webhook_command | live |
| journey_task_detail_defaults | fallback | reachable | g1_task_journey_runtime | g2_journey_task_owner | line_text / journey_task_detail | audience_leak_candidate |
| task_flex_labels_and_buttons | button | reachable | g1_task_journey_runtime | g2_journey_task_owner | line_flex / journey_task_detail | live |
| journey_command_replies | command_reply | reachable | g1_task_journey_runtime | g2_journey_task_owner | line_text / journey_commands | live |
| journey_reminder_message | reminder | reachable | g1_reminder_notification_runtime | g2_notification_owner | line_text / internal_job | audience_leak_candidate |
| blocked_reason_labels | label | conditionally_reachable | g1_task_journey_runtime | g2_journey_task_owner | line_text_or_ui_label / tasks | live |
| emergency_message_template | warning | conditionally_reachable | g1_adjacent_emergency_ops_runtime | g2_adjacent_ops_owner | notification_or_line_text / emergency | live |
| ops_escalation_default_notification | cta | conditionally_reachable | g1_adjacent_emergency_ops_runtime | g2_adjacent_ops_owner | notification / ops_next_action | audience_leak_candidate |

## Overlap Clusters Frozen

- direct-answer overlap cluster: school / banking / SSN across `free_contextual_followup_domain_answers`, `paid_casual_templates`, and `paid_domain_concierge_templates`.
- safety overlap cluster: disclaimer / clarify / refuse / generic fallback around `answer_readiness_gate_templates`, `required_core_facts_domain_clarify`, `verify_candidate_clarify_templates`, and `finalize_candidate_fallback_templates`.
- mixed-family risk: `webhook_assistant_top_level_templates` combines safety fallback with command or consent acknowledgement at G0 and must stay explicit.

## Shadow Freeze

- unconfirmed: `policy_override_disclaimer_templates`
- dead_or_test_only: `search_kb_replytext_templates`, `paid_assistant_legacy_structured_format`
- exclusions stay outside live grouping: internal prompts, developer prompts, pure test dummy, eval fixtures, docs-only runtime-unconnected examples
