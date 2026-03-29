# 13 Apply Readiness Plan

This file does not implement anything. It defines future add-only apply readiness only.

| Future slot | Readiness | Why now | Why not yet | No-merge guard |
| --- | --- | --- | --- | --- |
| faq_admin_registry_slot | high | Admin FAQ route has stable selectors and high observability. | generic disclaimer fallback branch exact wording assert | hard_no_merge |
| faq_compat_registry_slot | medium | Compat governance remains separate from admin FAQ and canonical assistant runtime. | generic disclaimer fallback branch exact wording assert | hard_no_merge |
| assistant_free_retrieval_registry_slot | medium | Free retrieval empty and ranked reply shells plus style wrapper share lane and owner. | direct searchFaqFromKb ranked replyText assert \| Choice, Debug, Story style exact string asserts | hard_no_merge |
| assistant_free_contextual_registry_slot | medium | Contextual followup direct answers are selected by a different semantic cluster than retrieval shells. | housing, ssn, banking free contextual direct answer exact asserts | hard_no_merge |
| assistant_paid_casual_registry_slot | medium | Paid casual route semantics are stable enough for future add-only slotting. | No extra blocker observed | hard_no_merge |
| assistant_paid_domain_registry_slot | medium | Paid domain answers and runtime knowledge fallback share domain lane ownership. | slice-specific runtime knowledge fallback exact lines | hard_no_merge |
| assistant_paid_format_registry_slot | medium | Formatting shell and guard defaults are downstream packaging contract. | No extra blocker observed | hard_no_merge |
| assistant_paid_safety_registry_slot | medium | Safety layers can only be slot-ready if decision semantics remain explicit and non-merged. | generic disclaimer fallback branch exact wording assert | hard_no_merge |
| webhook_top_level_registry_slot | low | Top-level lane remains mixed and low-readiness but future add-only slot is still definable. | No extra blocker observed | hard_no_merge |
| journey_text_registry_slot | medium | Command text replies share one command-parser responsibility and one audience. | No extra blocker observed | hard_no_merge |
| journey_task_registry_slot | medium | Task detail defaults, flex labels, and blocked reason labels share task surface semantics and leak monitoring needs. | audience leak regression assert | hard_no_merge |
| notification_registry_slot | medium | Outbound lifecycle notifications share delivery semantics and can be add-only slotted without merging with adjacent ops or renderer fallback. | internal trigger name suppression assert | hard_no_merge |
| line_renderer_fallback_registry_slot | medium | Renderer fallback is a distinct service slot, not semantic answer or notification copy. | No extra blocker observed | hard_no_merge |
| adjacent_ops_registry_slot | low | Adjacent runtime must stay distinct from main assistant and notification slots. | operator wording leak regression assert | hard_no_merge |
| policy_shadow_registry_slot | low | Explicit shadow slot keeps unconfirmed policy copy out of live registry units. | policy override resolution and fallback branch runtime proof | shadow_only |
| dead_shadow_registry_slot | low | Dead and test-only families should have a shadow parking slot, not a live registry bucket. | current live runtime reachability assert \| legacy formatter live reactivation guard | shadow_only |
| dynamic_quick_reply_surface_slot | low | Standalone preset runtime-connected quick reply family is not observed, but dynamic quick reply surface exists and should remain visible as a separate future slot candidate. | No extra blocker observed | shadow_only |

## Future Registry Slot Candidates

- Stable lane slots: faq_admin, assistant_free_retrieval, assistant_paid_casual, assistant_paid_domain, journey_text, journey_task, notification, line_renderer_fallback.
- Lower-readiness slots: webhook_top_level, adjacent_ops, policy_shadow, dead_shadow, dynamic_quick_reply_surface.

## Explicit Non-Live Handling

- `policy_override_disclaimer_templates` stays shadow-only until reachability evidence is upgraded.
- `search_kb_replytext_templates` and `paid_assistant_legacy_structured_format` stay shadow-only.
- dynamic quick reply remains a future slot candidate with zero included template families because standalone preset family is not observed.
