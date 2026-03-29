# 07 Surface Audience Matrix

| Family | Audience | Audience leak | Channel surface | Service surface | Notes |
| --- | --- | --- | --- | --- | --- |
| faq_disclaimer_templates | mixed | false | http_json | faq_admin,faq_compat,paid_assistant | Counts as preset user-facing text because exact strings are hardcoded and appended or returned directly. |
| policy_override_disclaimer_templates | operator | true | http_json_and_line_if_override_active | ops_config,admin_policy_editor | Policy seed copy is source-connected but end-user delivery remains unconfirmed. |
| faq_block_action_labels | mixed | false | http_json | faq_admin,faq_compat,admin_ui | Preset CTA labels are fixed even though suggested FAQ titles are dynamic. |
| free_retrieval_empty_reply | end_user | false | line_text | assistant_free | Exact title slot is dynamic; surrounding scaffold is preset. |
| free_retrieval_ranked_reply | end_user | false | line_text | assistant_free | Exact article ids, titles, and scores are dynamic; scaffold and labels are preset. |
| search_kb_replytext_templates | unknown | false | not_observed | search helper | Observed helper text exists, but current runtime-connected callers use candidate arrays or newer free retrieval formatter instead of this replyText. |
| response_style_templates | end_user | false | line_text | assistant_free_and_paid_humanized | This record groups eight preset style families; exact line bodies are fixed but action content inside them can be dynamic. |
| free_contextual_followup_domain_answers | end_user | false | line_text | assistant_free | Preset short followup answers are domain-specific and can add a question line when needsQuestion is true. |
| paid_casual_templates | end_user | false | line_text | assistant_paid | This family intentionally includes greeting, smalltalk, intro, generic prompt, followup action lines, and domain direct answers. |
| paid_domain_concierge_templates | end_user | false | line_text | assistant_paid | not_observed |
| paid_assistant_conversation_format | end_user | false | line_text | assistant_paid | Model-generated semantic content is dynamic; this record inventories only the fixed conversation scaffolding. |
| paid_assistant_legacy_structured_format | unknown | false | line_text | assistant_paid | Current runtime truth filter classified this family as dead_or_test_only for final user-visible output on main path. |
| paid_reply_guard_defaults | end_user | false | line_text | assistant_paid | This family is a structural guard and strips legacy terms before final delivery. |
| answer_readiness_gate_templates | mixed | false | line_text | assistant_paid,faq_http_json | not_observed |
| required_core_facts_domain_clarify | end_user | false | line_text | assistant_paid | not_observed |
| verify_candidate_clarify_templates | end_user | false | line_text | assistant_paid_orchestrator | not_observed |
| finalize_candidate_fallback_templates | end_user | false | line_text | assistant_paid_orchestrator | not_observed |
| runtime_knowledge_fallback_templates | end_user | false | line_text | assistant_mixed | This family is indirect: candidate text is built here, then consumed downstream by reply pipelines. |
| webhook_assistant_top_level_templates | end_user | false | line_text | line_webhook | This family mixes assistant fallback, clarify/refuse, synthetic ack, consent ack, and direct command acknowledgements that are all routed from webhookLine. |
| line_surface_renderer_defaults | end_user | false | line_text,line_template,line_flex | line_renderer | Route tracer observed assistant sends are mostly text today; flex/template defaults remain conditionally reachable through renderer policy and non-assistant flows. |
| welcome_message | end_user | false | line_text | welcome_notification | Pure fixed notification text; no dynamic blocks except delivery state. |
| notification_renderer_defaults | end_user | false | line_text,line_template_buttons | notifications | Notification titles, bodies, and CTA labels are usually dynamic; this family inventories only preset renderer defaults and join patterns. |
| region_line_messages | end_user | false | line_text | line_webhook_command | All four strings are hardcoded, runtime-connected direct command replies. |
| citypack_feedback_messages | end_user | false | line_text | line_webhook_command | Two fixed feedback texts only. |
| redac_membership_messages | end_user | false | line_text | line_webhook_command | Each reply is a summary + nextAction pair wrapped by withNextAction(). |
| journey_task_detail_defaults | end_user | true | line_text | journey_task_detail | Current runtime includes admin-facing task-detail wording in user-facing flow. |
| task_flex_labels_and_buttons | end_user | false | line_flex | journey_task_detail | All button labels and section labels are fixed preset user-facing text. |
| journey_command_replies | end_user | false | line_text | journey_commands | This family groups many hardcoded command replies because they share the same parser-driven command surface. |
| journey_reminder_message | end_user | true | line_text | internal_job | Reminder copy includes internal trigger framing in user-facing delivery path. |
| blocked_reason_labels | mixed | false | line_text_or_ui_label | tasks | User-facing label map was observed, but direct runtime surface was not fully traced; therefore conditionally_reachable. |
| emergency_message_template | mixed | false | notification_or_line_text | emergency | Adjacent runtime family included because it is preset user-facing text, but it is outside the main FAQ/assistant route. |
| ops_escalation_default_notification | mixed | true | notification | ops_next_action | Default English ops escalation notification can mix operator framing into outward notification path. |

## Special Surface Note

- Standalone preset runtime-connected quick reply family is not observed in the current audit. This does not mean quick reply surface is absent. Dynamic quick reply remains a surface-only special class and is represented in `g4_dynamic_quick_reply_surface_slot`.
