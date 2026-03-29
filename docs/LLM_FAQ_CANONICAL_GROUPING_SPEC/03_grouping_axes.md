# 03 Grouping Axes

Grouping stays audit-first and preserves raw families at G0 while layering G1 to G4 around route, owner, safety, audience, and future apply readiness.

| Axis | Definition | Observed source | Normalization rule | Unknown handling |
| --- | --- | --- | --- | --- |
| 1. raw family id | Audited template family at G0 | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/03_template_inventory.json | Use `template_id` exactly | not used |
| 2. runtime truth | reachable / conditionally_reachable / unconfirmed / dead_or_test_only | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/07_runtime_truth_report.md | Preserve exactly | not_observed only for quick reply special class |
| 3. runtime lane | Current runtime lane grouping | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/05_selection_paths.md and current route code | G1 lane only | unknown not used once lane evidence exists |
| 4. canonical owner route | Where future copy SSOT should live | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/Member_LLM_Integrated_Spec_V1.md plus route ownership | G2 owner group | unknown when no stable owner exists |
| 5. upstream selectors | Predicates that must hold before selection | inventory.selection_predicates plus route code | Keep as decision-bearing facts | unknown |
| 6. decision nodes | Functions or branches that select or gate copy | inventory.decision_nodes plus route code | Keep as route-specific | unknown |
| 7. safety role | faq / direct_answer / clarify / fallback / warning / disclaimer / cta / button / label / notification / mixed | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/08_overlap_gap_report.md | Map from template_kind and audited role | mixed |
| 8. audience type | end_user / operator / mixed / unknown | service_surface plus plan gate plus runtime route | Do not infer beyond evidence | unknown |
| 9. audience leak flag | Whether current runtime can surface operator-style or internal wording to end-users | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/04_template_inventory_human_readable.md plus source code | Explicit true only when evidence exists | false or unknown |
| 10. channel surface | Transport or rendering surface labels | inventory.channel_surface | Keep observed value families | unknown |
| 11. service surface | Service or runtime scope labels | inventory.service_surface | Keep observed value families | unknown |
| 12. action class | Integrated spec contract axis | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/Member_LLM_Integrated_Spec_V1.md | Structural crosswalk only | unknown |
| 13. handoff semantics | Integrated spec handoff axis | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/Member_LLM_Integrated_Spec_V1.md | Structural crosswalk only | unknown |
| 14. chapter or domain | Integrated chapter or domain context | inventory.chapter and inventory.domain | Preserve as observed | unknown |
| 15. merge safety | hard_no_merge / soft_no_merge / shadow_only | this spec + audit overlap evidence | Prefer hard boundaries when route, audience, safety, or runtime truth differ | shadow_only for special classes |
| 16. future registry readiness | low / medium / high readiness for add-only slotting | current route stability plus lane stability | Do not overstate readiness | low |

## Integrated Spec Crosswalk Notes

- `lifecycle_stage`, `intent_type`, `answer_mode`, `action_class`, `handoff_state`, `channel_surface`, and `service_surface` are structurally aligned at key-name level, but value-level crosswalk is not deterministic in the current audit inventory.
- Therefore this grouping spec uses audit-native values first and records integrated-spec alignment as a structural reference only.
