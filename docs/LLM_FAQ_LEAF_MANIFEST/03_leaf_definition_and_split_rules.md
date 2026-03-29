# 03 Leaf Definition And Split Rules

## Leaf definition
- 1 leaf = 1 route responsibility × 1 audience scope × 1 safety role × 1 output shape × 1 selection semantic cluster × 1 downstream contract envelope × 1 claim boundary.
- When any one of those boundaries mixes, the leaf must split or be isolated.

## Output shape vocabulary
- `plain_text_answer`
- `ranked_answer_with_candidates`
- `disclaimer_block`
- `fallback_text`
- `clarify_prompt`
- `refuse_text`
- `consent_ack`
- `command_ack`
- `flex_label_set`
- `flex_button_set`
- `reminder_text`
- `notification_text`
- `renderer_default_text`
- `welcome_text`
- `operator_notification_text`
- `unknown_shape`

## Split triggers
- mixed audience
- mixed safety role
- mixed output shape
- mixed route responsibility
- mixed downstream contract
- ack/answer/fallback/disclaimer/label/button coexistence
- same-copy or same-family but different selector semantics
- main assistant and adjacent runtime coexistence
- user-facing and operator-facing wording coexistence
- live and shadow coexistence

## Mandatory split decisions
| G3 unit | Decision | Reason |
| --- | --- | --- |
| g3_webhook_top_level_unit | split | fallback/clarify/refuse/consent/direct-command ack coexist |
| g3_paid_safety_gate_unit | split | readiness/core-facts/verify/finalizer stages coexist |
| g3_journey_task_surface_unit | split | leak candidate + text/flex/labels coexist |
| g3_notification_renderer_unit | split | body fallback / alt-text / CTA join are different contracts |
| g3_free_retrieval_search_unit | split | empty / ranked / style branches are different answer envelopes |
| g3_faq_admin_answer_unit | split | disclaimer / blocked CTA / readiness branches share one route but not one safety role |
| g3_faq_compat_answer_unit | split | compat route mirrors FAQ admin but must stay route-specific |

## Split not required right now
| unit | current handling | why not further split |
| --- | --- | --- |
| g3_free_contextual_followup_unit | one human-reviewed leaf | one route, one audience, one output shape; domain sub-split remains open |
| g3_paid_casual_unit | one human-reviewed leaf | canonical grouping still treats paid casual as one lane; direct domain split remains open |
| g3_paid_domain_answer_unit | two leaves (`paid_domain_concierge`, `runtime_knowledge_fallback`) | current owner split is answer vs fallback; deeper domain split remains open |
| g3_paid_conversation_format_unit | two leaves | format shell vs guard fallback is sufficient for current downstream contract |
| g3_adjacent_emergency_unit | one human-reviewed leaf | one adjacent emergency warning block observed |

## Counterexamples
1. Mixed G3 unit to GPT as-is is wrong because selection nodes and output shapes collapse. Detection: unit has mixed safety/output in audit inventory. Prevention: leaf split by branch or role.
2. Same-copy still needs separate leaves when route ownership differs. Detection: shared family appears in multiple G3/G4 routes. Prevention: route-specific disclaimer leaves for FAQ admin/compat/paid.
3. Shadow unit in live generation target is wrong because runtime truth is unconfirmed or dead. Detection: `shadow_only` / `dead_or_test_only`. Prevention: `exclude_shadow` leaf status.
4. Audience leak mixed into normal leaf is wrong because operator/admin framing can ship to end users. Detection: `audience_leak=true`. Prevention: isolate leaves for task detail, reminder, ops escalation.
5. Ignoring output shape is wrong because CTA/join/flex/text contracts differ. Detection: inventory renderer or payload type differs. Prevention: dedicated leaves for notification body vs alt-text vs CTA join and task flex labels vs buttons.
6. Treating quick reply not-observed as absent is wrong because dynamic surface may still exist. Detection: grouping risk register and dynamic slot. Prevention: future-surface unknown leaf.
7. Weak test anchors treated as ready-to-apply is wrong because exact strings and shapes are under-specified. Detection: missing exact-string or output-shape anchor. Prevention: human-review flags and open questions.
