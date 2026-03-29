# 01 Input Validation

## Count validation
| Item | Expected | Observed | Status |
| --- | --- | --- | --- |
| G0 raw families | 32 | 32 | match |
| G1 runtime lanes | 12 | 12 | match |
| G2 owners | 14 | 14 | match |
| G3 handoff units | 20 | 20 | match |
| G4 future registry groups | 17 | 17 | match |
| Exact text blocks | 319 | 319 | match |

## Runtime truth validation
| Runtime truth | Expected | Observed | Status |
| --- | --- | --- | --- |
| reachable | 15 | 15 | match |
| conditionally_reachable | 14 | 14 | match |
| unconfirmed | 1 | 1 | match |
| dead_or_test_only | 2 | 2 | match |

## Must-preserve special classes
| Special class | Expected status | Observed | Notes |
| --- | --- | --- | --- |
| policy_override_disclaimer_templates | shadow policy class / unconfirmed / generation target excluded | validated | kept as exclude_shadow leaf |
| search_kb_replytext_templates | dead/test shadow / generation target excluded | validated | kept as exclude_shadow leaf |
| paid_assistant_legacy_structured_format | dead/test shadow / generation target excluded | validated | kept as exclude_shadow leaf |
| standalone preset runtime-connected quick reply family | not observed | validated | recorded as future surface slot only |
| leak candidates | isolate or special handling | validated | journey task detail / journey reminder / ops escalation isolated |

## Differences or cautions
- `paid_reply_guard_defaults` appears in `11_template_to_group_mapping.csv` with overlap into the paid safety slot, but the canonical G3 JSON keeps its parent handoff unit as `g3_paid_conversation_format_unit`. This leaf manifest follows the canonical grouping JSON and notes the overlap instead of re-parenting the family.
- Integrated spec file is present and usable as a downstream-contract crosswalk reference, but value-level enum parity remains unobserved; this manifest keeps audit-native values.
