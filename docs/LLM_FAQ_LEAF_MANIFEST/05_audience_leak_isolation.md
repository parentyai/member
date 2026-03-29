# 05 Audience Leak Isolation

## Isolated leak leaves
| leaf_id | source family | reason |
| --- | --- | --- |
| leaf_task_detail_defaults_isolate | journey_task_detail_defaults | Current runtime includes admin-facing Task Detail Editor wording in user-facing task detail replies. |
| leaf_journey_reminder_message | journey_reminder_message | Reminder copy includes trigger metadata in current user-facing delivery path. |
| leaf_ops_escalation_title_isolate | ops_escalation_default_notification | Current outward notification path can expose operator/ops framing. |
| leaf_ops_escalation_body_isolate | ops_escalation_default_notification | Current outward notification path can expose operator/ops framing. |
| leaf_ops_escalation_button_isolate | ops_escalation_default_notification | Current outward notification path can expose operator/ops framing. |

## Isolation rule
- Leak candidates do not enter normal generation guidance leaves.
- They remain visible for human or separate-policy review rather than being normalized away.
