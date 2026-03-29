# 06 No-Merge Boundaries

## Boundary Rules

| Rule | Class | Trigger | Scope | Protection effect |
| --- | --- | --- | --- | --- |
| H1 | hard_no_merge | audience differs | operator vs human or mixed leak-sensitive audience split | Do not merge operator/admin wording with end-user wording. |
| H2 | hard_no_merge | runtime scope or route family differs | faq runtime vs assistant runtime vs journey vs adjacent runtime | Route responsibility stays explicit even when copy converges. |
| H3 | hard_no_merge | audience leak risk exists | admin or operator wording, banned terms, internal trace leakage | Leak candidates remain visible and isolated. |
| H4 | hard_no_merge | live vs shadow truth differs | reachable vs unconfirmed vs dead_or_test_only | Do not merge live families with shadow classes. |
| H5 | hard_no_merge | safety role differs | disclaimer vs clarify vs refuse vs generic fallback vs CTA | Safety semantics outrank wording similarity. |
| S1 | soft_no_merge | same reply fingerprint but different route attribution | same-copy and different-route cases | Track together analytically, do not collapse ownership without GO evidence. |
| Z1 | shadow_only | observation-first or shadow governance path | policy override, dead/test-only, dynamic quick reply slot | Keep outside live groups until evidence upgrades. |
| Z2 | shadow_only | dead or legacy reactivation risk | legacy formatter, dead helper reply text | Preserve for audit only. |

## Counterexample Duty

| Counterexample | Wrong judgment | Why wrong | How to detect | How the spec prevents it |
| --- | --- | --- | --- | --- |
| 1 | Same copy means same group | Route attribution, safety role, and telemetry can differ even with identical final wording. | Check route responsibility and decision nodes before grouping. | G1 and G3 keep route-specific units even when family reuse exists. |
| 2 | One owner for every similar selector | Selection path differences can carry different governance or compat constraints. | Compare route family, flags, and decision nodes. | FAQ admin and FAQ compat remain separate units and slots. |
| 3 | Safety copy can be grouped by wording only | Clarify, refuse, disclaimer, and fallback are fail-safe semantics, not style variations. | Inspect gate function names and contract tests. | G1 paid_safety_layers and G2 assistant_paid_safety_owner stay separate from domain and notification owners. |
| 4 | Audience leak can be hidden inside broad journey or ops groups | Current runtime includes explicit leak candidates. | Flag families with admin or internal phrasing in end-user path. | audience_leak=true is preserved on affected groups and families. |
| 5 | Quick reply is absent because preset family is not observed | Dynamic quick reply surface exists even without a standalone preset family. | Inspect lineInteractionPolicy and semanticLineMessage usage. | G4 dynamic_quick_reply_surface_slot remains as a dedicated special class. |
| 6 | Dead or test-only families can join live corpus because they resemble current copy | Reachability is part of the grouping boundary. | Compare runtime_truth and current route evidence. | dead_test_shadow_runtime and shadow_not_live_owner keep them isolated. |
| 7 | Policy override unconfirmed can be treated as reachable | Source connection is not equivalent to live end-user proof. | Require runtime evidence beyond seed presence. | policy_shadow_runtime and policy_override_owner remain shadow_only. |

## Family-Level Hard Boundaries

- `policy_override_disclaimer_templates` must not merge with any live disclaimer group.
- `search_kb_replytext_templates` and `paid_assistant_legacy_structured_format` must not merge with live free or paid families.
- `journey_task_detail_defaults` must not be normalized into generic journey success copy because the current audience leak needs visibility.
- `ops_escalation_default_notification` must not merge with notification lifecycle groups because adjacent runtime and audience leak semantics differ.
- `answer_readiness_gate_templates`, `required_core_facts_domain_clarify`, `verify_candidate_clarify_templates`, and `finalize_candidate_fallback_templates` remain distinct safety-role units even when copy overlap is high.
