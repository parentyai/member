# 04 Shadow And Exclusion Report

## Exclude shadow leaves
| leaf_id | source family | runtime truth | reason |
| --- | --- | --- | --- |
| leaf_policy_override_shadow | policy_override_disclaimer_templates | unconfirmed | Special obligation: policy override must remain shadow and excluded. |
| leaf_search_kb_replytext_shadow | search_kb_replytext_templates | dead_or_test_only | Dead/test-only helper text is outside live manifest scope. |
| leaf_paid_assistant_legacy_shadow | paid_assistant_legacy_structured_format | dead_or_test_only | Legacy structured formatter is dead/test-only on the main runtime path. |

## Future surface slot only
- `leaf_future_quick_reply_surface_slot` keeps the quick reply special case explicit without claiming a runtime-connected preset family exists.

## Exclusion classes referenced from prior audit
- dead/test-only
- policy shadow
- internal/test exclusions remain in the audit exclusion report and are not promoted here
