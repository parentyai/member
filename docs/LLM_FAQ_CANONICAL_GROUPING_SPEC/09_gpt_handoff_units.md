# 09 GPT Handoff Units

unit_id: unit_faq_admin_answer
unit_name: g3_faq_admin_answer_unit
source_group_ids: g3_faq_admin_answer_unit
source_template_families: faq_disclaimer_templates, faq_block_action_labels, answer_readiness_gate_templates
why_this_is_one_unit: One admin FAQ route responsibility
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Compat route and paid safety route differ
route_scope: POST /api/admin/llm/faq/answer
audience_scope: mixed
surface_scope: http_json
safety_scope: FAQ disclaimer and blocking
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_faq_http_owner
apply_readiness: high
open_questions: generic disclaimer fallback branch exact wording assert

unit_id: unit_faq_compat_answer
unit_name: g3_faq_compat_answer_unit
source_group_ids: g3_faq_compat_answer_unit
source_template_families: faq_disclaimer_templates, faq_block_action_labels, answer_readiness_gate_templates
why_this_is_one_unit: One compat FAQ route responsibility
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Compat governance and freeze flag differ
route_scope: POST /api/phaseLLM4/faq/answer
audience_scope: mixed
surface_scope: http_json
safety_scope: FAQ compat disclaimer and blocking
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_faq_http_owner
apply_readiness: medium
open_questions: generic disclaimer fallback branch exact wording assert

unit_id: unit_free_retrieval_search
unit_name: g3_free_retrieval_search_unit
source_group_ids: g3_free_retrieval_search_unit
source_template_families: free_retrieval_empty_reply, free_retrieval_ranked_reply, response_style_templates
why_this_is_one_unit: One free retrieval lane
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Contextual direct answers differ
route_scope: POST /webhook/line free retrieval
audience_scope: end_user
surface_scope: line_text
safety_scope: free retrieval search
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_assistant_free_owner
apply_readiness: medium
open_questions: direct searchFaqFromKb ranked replyText assert | Choice, Debug, Story style exact string asserts

unit_id: unit_free_contextual_followup
unit_name: g3_free_contextual_followup_unit
source_group_ids: g3_free_contextual_followup_unit
source_template_families: free_contextual_followup_domain_answers
why_this_is_one_unit: One free contextual lane
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Search and paid domain differ
route_scope: POST /webhook/line free contextual followup
audience_scope: end_user
surface_scope: line_text
safety_scope: direct domain answer
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_assistant_free_owner
apply_readiness: medium
open_questions: housing, ssn, banking free contextual direct answer exact asserts

unit_id: unit_paid_casual
unit_name: g3_paid_casual_unit
source_group_ids: g3_paid_casual_unit
source_template_families: paid_casual_templates
why_this_is_one_unit: One paid casual route
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Domain and safety units differ
route_scope: POST /webhook/line paid casual
audience_scope: end_user
surface_scope: line_text
safety_scope: casual answer
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_assistant_paid_casual_owner
apply_readiness: medium
open_questions: none

unit_id: unit_paid_domain
unit_name: g3_paid_domain_answer_unit
source_group_ids: g3_paid_domain_answer_unit
source_template_families: paid_domain_concierge_templates, runtime_knowledge_fallback_templates
why_this_is_one_unit: One paid domain route
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Safety and formatting units differ
route_scope: POST /webhook/line paid domain
audience_scope: end_user
surface_scope: line_text
safety_scope: domain answer and domain fallback
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_assistant_paid_domain_owner
apply_readiness: medium
open_questions: slice-specific runtime knowledge fallback exact lines

unit_id: unit_paid_format
unit_name: g3_paid_conversation_format_unit
source_group_ids: g3_paid_conversation_format_unit
source_template_families: paid_assistant_conversation_format, paid_reply_guard_defaults
why_this_is_one_unit: One paid conversation shell
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Semantic answer and safety units differ
route_scope: POST /webhook/line paid finalization
audience_scope: end_user
surface_scope: line_text
safety_scope: format shell
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_assistant_paid_format_owner
apply_readiness: medium
open_questions: none

unit_id: unit_paid_disclaimer
unit_name: g3_paid_disclaimer_unit
source_group_ids: g3_paid_disclaimer_unit
source_template_families: faq_disclaimer_templates
why_this_is_one_unit: One paid disclaimer purpose
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Shared raw family still has different route responsibility
route_scope: POST /webhook/line paid assistant
audience_scope: end_user
surface_scope: line_text
safety_scope: disclaimer
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_disclaimer_owner
apply_readiness: medium
open_questions: generic disclaimer fallback branch exact wording assert

unit_id: unit_paid_safety
unit_name: g3_paid_safety_gate_unit
source_group_ids: g3_paid_safety_gate_unit
source_template_families: answer_readiness_gate_templates, required_core_facts_domain_clarify, verify_candidate_clarify_templates, finalize_candidate_fallback_templates
why_this_is_one_unit: One paid safety policy cluster
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Domain answers and format shell differ
route_scope: paid orchestrator
audience_scope: mixed
surface_scope: line_text
safety_scope: clarify and fallback safety
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_assistant_paid_safety_owner
apply_readiness: medium
open_questions: none

unit_id: unit_webhook_top_level
unit_name: g3_webhook_top_level_unit
source_group_ids: g3_webhook_top_level_unit
source_template_families: webhook_assistant_top_level_templates
why_this_is_one_unit: One top-level webhook responsibility
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Notification and adjacent runtime differ
route_scope: POST /webhook/line top-level
audience_scope: end_user
surface_scope: line_text
safety_scope: top-level ack or fallback
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_webhook_top_level_owner
apply_readiness: low
open_questions: none

unit_id: unit_welcome_message
unit_name: g3_welcome_message_unit
source_group_ids: g3_welcome_message_unit
source_template_families: welcome_message
why_this_is_one_unit: One welcome lifecycle trigger
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Reminder and webhook entry differ
route_scope: welcome push flow
audience_scope: end_user
surface_scope: line_text
safety_scope: notification
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_notification_owner
apply_readiness: medium
open_questions: none

unit_id: unit_line_renderer_fallback
unit_name: g3_line_renderer_service_fallback_unit
source_group_ids: g3_line_renderer_service_fallback_unit
source_template_families: line_surface_renderer_defaults
why_this_is_one_unit: One renderer service fallback responsibility
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Notification CTA and safety copy differ
route_scope: renderer fallback
audience_scope: end_user
surface_scope: line_text and line_template and line_flex
safety_scope: service fallback
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_line_renderer_default_owner
apply_readiness: medium
open_questions: none

unit_id: unit_notification_renderer
unit_name: g3_notification_renderer_unit
source_group_ids: g3_notification_renderer_unit
source_template_families: notification_renderer_defaults
why_this_is_one_unit: One notification send responsibility
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Adjacent ops notification differs
route_scope: notification sender
audience_scope: end_user
surface_scope: line_text and buttons
safety_scope: notification CTA
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_notification_owner
apply_readiness: medium
open_questions: none

unit_id: unit_journey_direct_command
unit_name: g3_journey_direct_command_unit
source_group_ids: g3_journey_direct_command_unit
source_template_families: region_line_messages, citypack_feedback_messages, redac_membership_messages, journey_command_replies
why_this_is_one_unit: One command parser responsibility
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Task surface unit differs
route_scope: journey direct command parser
audience_scope: end_user
surface_scope: line_text
safety_scope: command reply
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_journey_task_owner
apply_readiness: medium
open_questions: none

unit_id: unit_journey_task_surface
unit_name: g3_journey_task_surface_unit
source_group_ids: g3_journey_task_surface_unit
source_template_families: journey_task_detail_defaults, task_flex_labels_and_buttons, blocked_reason_labels
why_this_is_one_unit: One task detail and postback responsibility
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Command text and notification units differ
route_scope: journey task detail and postback
audience_scope: end_user
surface_scope: line_text and line_flex
safety_scope: task surface
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_journey_task_owner
apply_readiness: medium
open_questions: audience leak regression assert

unit_id: unit_journey_reminder
unit_name: g3_journey_reminder_unit
source_group_ids: g3_journey_reminder_unit
source_template_families: journey_reminder_message
why_this_is_one_unit: One reminder job responsibility
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Welcome and ops notification differ
route_scope: internal reminder jobs
audience_scope: end_user
surface_scope: line_text
safety_scope: reminder
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_notification_owner
apply_readiness: medium
open_questions: internal trigger name suppression assert

unit_id: unit_adjacent_emergency
unit_name: g3_adjacent_emergency_unit
source_group_ids: g3_adjacent_emergency_unit
source_template_families: emergency_message_template
why_this_is_one_unit: One emergency adjacent runtime responsibility
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Main assistant and lifecycle notification differ
route_scope: internal emergency jobs
audience_scope: mixed
surface_scope: notification_or_line_text
safety_scope: warning
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_adjacent_ops_owner
apply_readiness: low
open_questions: none

unit_id: unit_adjacent_ops_notification
unit_name: g3_adjacent_ops_notification_unit
source_group_ids: g3_adjacent_ops_notification_unit
source_template_families: ops_escalation_default_notification
why_this_is_one_unit: One ops adjacent runtime responsibility
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Notification lifecycle unit differs
route_scope: phase33 ops decision execute
audience_scope: mixed
surface_scope: notification
safety_scope: cta and notification
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_adjacent_ops_owner
apply_readiness: low
open_questions: operator wording leak regression assert

unit_id: unit_policy_override_shadow
unit_name: g3_policy_override_shadow_unit
source_group_ids: g3_policy_override_shadow_unit
source_template_families: policy_override_disclaimer_templates
why_this_is_one_unit: One shadow policy seed unit
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Live disclaimer units differ
route_scope: ops config policy path
audience_scope: operator
surface_scope: http_json_and_line_if_override_active
safety_scope: disclaimer
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_policy_override_owner
apply_readiness: low
open_questions: policy override resolution and fallback branch runtime proof

unit_id: unit_dead_shadow
unit_name: g3_dead_shadow_unit
source_group_ids: g3_dead_shadow_unit
source_template_families: search_kb_replytext_templates, paid_assistant_legacy_structured_format
why_this_is_one_unit: One dead or legacy shadow unit
why_it_is_not_split_further: This unit already keeps one route responsibility, one audience, one safety policy, one surface family, and one selection semantic cluster.
why_it_must_not_merge_with: Live free and paid units differ
route_scope: shadow only
audience_scope: unknown
surface_scope: not_observed
safety_scope: shadow
required_facts_scope: Only facts already observed in the audit inventory and current route or gate evidence.
prohibited_claim_scope: No new copy, no lane promotion, no assumption that shared wording equals shared ownership.
style_constraints: Preserve current runtime role and channel contract; do not synthesize new style goals here.
copy_shape_constraints: Keep fixed or semi-fixed user-facing blocks, CTA labels, and safety notes separated by route responsibility.
downstream_contract_constraints: Respect current downstream payload type, renderer, and audience leak visibility.
owner_before_apply: g2_shadow_not_live_owner
apply_readiness: low
open_questions: current live runtime reachability assert | legacy formatter live reactivation guard

