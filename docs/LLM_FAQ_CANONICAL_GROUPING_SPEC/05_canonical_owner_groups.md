# 05 Canonical Owner Groups

| Owner group | Families | Canonical route scope | Audience | Registry readiness | Notes |
| --- | --- | --- | --- | --- | --- |
| disclaimer_owner | faq_disclaimer_templates | FAQ admin \| FAQ compat \| paid assistant | mixed | high | Do not merge with policy override seed or safety gate copy. |
| faq_http_owner | faq_block_action_labels | POST /api/admin/llm/faq/answer \| POST /api/phaseLLM4/faq/answer | mixed | high | Keep FAQ block CTA labels out of LINE button or notification families. |
| assistant_free_owner | free_retrieval_empty_reply \| free_retrieval_ranked_reply \| response_style_templates \| free_contextual_followup_domain_answers | POST /webhook/line free branch | end_user | medium | Direct-answer overlap with paid domain is a duplication cluster, not a license to merge owners. |
| assistant_paid_casual_owner | paid_casual_templates | POST /webhook/line paid casual branch | end_user | medium | Keep casual reassurance separate from domain expertise and safety fallback. |
| assistant_paid_domain_owner | paid_domain_concierge_templates \| runtime_knowledge_fallback_templates | POST /webhook/line paid domain branch | end_user | medium | Overlap with free contextual direct answers is intentional duplication risk and stays cross-owner. |
| assistant_paid_format_owner | paid_assistant_conversation_format \| paid_reply_guard_defaults | POST /webhook/line paid answer finalization | end_user | medium | Formatting shell is a downstream contract boundary. |
| assistant_paid_safety_owner | answer_readiness_gate_templates \| required_core_facts_domain_clarify \| verify_candidate_clarify_templates \| finalize_candidate_fallback_templates | paid assistant orchestrator \| FAQ readiness path | mixed | medium | Intentional redundancy is allowed inside this owner only when decision semantics remain explicit. |
| webhook_top_level_owner | webhook_assistant_top_level_templates | POST /webhook/line | end_user | low | Mixed family and low registry readiness. |
| line_renderer_default_owner | line_surface_renderer_defaults | renderer fallback invocation | end_user | medium | Special service-fallback owner. |
| notification_owner | welcome_message \| notification_renderer_defaults \| journey_reminder_message | welcome flow \| notification sender \| journey reminder jobs | end_user | medium | Do not absorb renderer service fallback into this owner. |
| journey_task_owner | region_line_messages \| citypack_feedback_messages \| redac_membership_messages \| journey_task_detail_defaults \| task_flex_labels_and_buttons \| journey_command_replies \| blocked_reason_labels | journey commands \| journey postbacks | end_user | medium | Surface changes do not justify merging task surfaces with assistant answer families. |
| adjacent_ops_owner | emergency_message_template \| ops_escalation_default_notification | emergency jobs \| phase33 ops decision execute | mixed | low | Keep adjacent runtime separate from main assistant and notification owners. |
| policy_override_owner | policy_override_disclaimer_templates | ops config policy set and status | operator | low | Special shadow owner. |
| shadow_not_live_owner | search_kb_replytext_templates \| paid_assistant_legacy_structured_format | not on current live default route | unknown | low | Special shadow owner. |

## Owner Principles

- owner grouping does not re-interpret the raw estate; it defines where future copy SSOT should live if add-only implementation is approved later.
- shared-family reuse across routes does not erase owner separation. `faq_disclaimer_templates` is the clearest example: one raw family, multiple route responsibilities, one dedicated disclaimer owner.
