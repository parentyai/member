# 12 Exec Summary

- repo_head: `834eaf010876a6c08d21efd38a0e135df7987cb4`
- total leafs: `80`
- generate leafs: `71`
- isolate leafs: `5`
- exclude_shadow leafs: `3`
- unknown leafs: `1`

## Mixed-unit split summary
| G3 unit | resulting leaf count |
| --- | --- |
| g3_faq_admin_answer_unit | 5 |
| g3_faq_compat_answer_unit | 5 |
| g3_free_retrieval_search_unit | 10 |
| g3_paid_safety_gate_unit | 8 |
| g3_webhook_top_level_unit | 8 |
| g3_notification_renderer_unit | 3 |
| g3_journey_task_surface_unit | 4 |
| g3_journey_direct_command_unit | 14 |

## Generation target cautions
- `leaf_future_quick_reply_surface_slot` is not a live generation target.
- leak candidates remain isolated and do not enter normal generation guidance.
- shadow and dead/test-only families remain excluded.
