# 04 Leaf Manifest

- total leafs: `80`
- generate: `71`
- isolate: `5`
- exclude_shadow: `3`
- unknown: `1`

## g3_faq_admin_answer_unit
### leaf_faq_admin_disclaimer
- parent_g3_unit: `g3_faq_admin_answer_unit`
- parent_g4_group: `g4_faq_admin_registry_slot`
- leaf_status: `generate`
- route責務: `POST /api/admin/llm/faq/answer`
- audience: `mixed` leak=`false`
- safety role: `disclaimer`
- output shape: `disclaimer_block`
- source families: `faq_disclaimer_templates`
- split reason: Shared raw disclaimer family is reused across routes; admin and compat must stay route-specific.
- must_keep_facts: Preserve FAQ-purpose disclaimer wording and generic disclaimer fallback visibility.; Keep FAQ HTTP route ownership explicit.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not replace FAQ disclaimer with paid-assistant or policy-only disclaimer.
- must_not_generate: new route names; new policy override behavior
- must_not_merge_with: leaf_faq_compat_disclaimer, leaf_paid_disclaimer, leaf_policy_override_shadow
- test 状態: current=`yes` exact=`no` route=`yes` shape=`yes` human_review=`yes`
- open questions: generic disclaimer fallback branch exact assert remains weak

### leaf_faq_admin_block_actions
- parent_g3_unit: `g3_faq_admin_answer_unit`
- parent_g4_group: `g4_faq_admin_registry_slot`
- leaf_status: `generate`
- route責務: `POST /api/admin/llm/faq/answer`
- audience: `mixed` leak=`false`
- safety role: `cta`
- output shape: `unknown_shape`
- source families: `faq_block_action_labels`
- split reason: CTA labels are a separate output shape from disclaimer and readiness text.
- must_keep_facts: Keep fixed action labels for blocked FAQ response payloads.; Preserve action-key-to-label semantics for official FAQ/contact actions.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not invent new action keys or URLs.
- must_not_generate: new CTA actions; button count changes
- must_not_merge_with: leaf_faq_admin_readiness_clarify, leaf_faq_compat_block_actions
- test 状態: current=`yes` exact=`yes` route=`yes` shape=`unknown` human_review=`yes`
- open questions: none

### leaf_faq_admin_readiness_clarify
- parent_g3_unit: `g3_faq_admin_answer_unit`
- parent_g4_group: `g4_faq_admin_registry_slot`
- leaf_status: `generate`
- route責務: `POST /api/admin/llm/faq/answer`
- audience: `mixed` leak=`false`
- safety role: `warning`
- output shape: `clarify_prompt`
- source families: `answer_readiness_gate_templates`
- split reason: Readiness decisions have distinct selection nodes and output roles.
- must_keep_facts: Keep the clarify readiness decision text separate from allow-path answers.; Preserve readiness gate semantics at the FAQ HTTP boundary.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not collapse readiness clarify/refuse/hedge into one generic copy block.
- must_not_generate: new decision names; new readiness states
- must_not_merge_with: leaf_paid_readiness_clarify_default, leaf_webhook_readiness_clarify
- test 状態: current=`yes` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_faq_admin_readiness_refuse
- parent_g3_unit: `g3_faq_admin_answer_unit`
- parent_g4_group: `g4_faq_admin_registry_slot`
- leaf_status: `generate`
- route責務: `POST /api/admin/llm/faq/answer`
- audience: `mixed` leak=`false`
- safety role: `warning`
- output shape: `refuse_text`
- source families: `answer_readiness_gate_templates`
- split reason: Readiness decisions have distinct selection nodes and output roles.
- must_keep_facts: Keep the refuse readiness decision text separate from allow-path answers.; Preserve readiness gate semantics at the FAQ HTTP boundary.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not collapse readiness clarify/refuse/hedge into one generic copy block.
- must_not_generate: new decision names; new readiness states
- must_not_merge_with: leaf_paid_readiness_clarify_default, leaf_webhook_readiness_clarify
- test 状態: current=`yes` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_faq_admin_readiness_hedge
- parent_g3_unit: `g3_faq_admin_answer_unit`
- parent_g4_group: `g4_faq_admin_registry_slot`
- leaf_status: `generate`
- route責務: `POST /api/admin/llm/faq/answer`
- audience: `mixed` leak=`false`
- safety role: `warning`
- output shape: `disclaimer_block`
- source families: `answer_readiness_gate_templates`
- split reason: Readiness decisions have distinct selection nodes and output roles.
- must_keep_facts: Keep the hedge readiness decision text separate from allow-path answers.; Preserve readiness gate semantics at the FAQ HTTP boundary.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not collapse readiness clarify/refuse/hedge into one generic copy block.
- must_not_generate: new decision names; new readiness states
- must_not_merge_with: leaf_paid_readiness_clarify_default, leaf_webhook_readiness_clarify
- test 状態: current=`yes` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

## g3_faq_compat_answer_unit
### leaf_faq_compat_disclaimer
- parent_g3_unit: `g3_faq_compat_answer_unit`
- parent_g4_group: `g4_faq_compat_registry_slot`
- leaf_status: `generate`
- route責務: `POST /api/phaseLLM4/faq/answer`
- audience: `mixed` leak=`false`
- safety role: `disclaimer`
- output shape: `disclaimer_block`
- source families: `faq_disclaimer_templates`
- split reason: Shared raw disclaimer family is reused across routes; admin and compat must stay route-specific.
- must_keep_facts: Preserve FAQ-purpose disclaimer wording and generic disclaimer fallback visibility.; Keep FAQ HTTP route ownership explicit.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not replace FAQ disclaimer with paid-assistant or policy-only disclaimer.
- must_not_generate: new route names; new policy override behavior
- must_not_merge_with: leaf_paid_disclaimer, leaf_policy_override_shadow
- test 状態: current=`yes` exact=`no` route=`yes` shape=`yes` human_review=`yes`
- open questions: generic disclaimer fallback branch exact assert remains weak

### leaf_faq_compat_block_actions
- parent_g3_unit: `g3_faq_compat_answer_unit`
- parent_g4_group: `g4_faq_compat_registry_slot`
- leaf_status: `generate`
- route責務: `POST /api/phaseLLM4/faq/answer`
- audience: `mixed` leak=`false`
- safety role: `cta`
- output shape: `unknown_shape`
- source families: `faq_block_action_labels`
- split reason: CTA labels are a separate output shape from disclaimer and readiness text.
- must_keep_facts: Keep fixed action labels for blocked FAQ response payloads.; Preserve action-key-to-label semantics for official FAQ/contact actions.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not invent new action keys or URLs.
- must_not_generate: new CTA actions; button count changes
- must_not_merge_with: leaf_faq_admin_readiness_clarify
- test 状態: current=`yes` exact=`yes` route=`yes` shape=`unknown` human_review=`yes`
- open questions: none

### leaf_faq_compat_readiness_clarify
- parent_g3_unit: `g3_faq_compat_answer_unit`
- parent_g4_group: `g4_faq_compat_registry_slot`
- leaf_status: `generate`
- route責務: `POST /api/phaseLLM4/faq/answer`
- audience: `mixed` leak=`false`
- safety role: `warning`
- output shape: `clarify_prompt`
- source families: `answer_readiness_gate_templates`
- split reason: Readiness decisions have distinct selection nodes and output roles.
- must_keep_facts: Keep the clarify readiness decision text separate from allow-path answers.; Preserve readiness gate semantics at the FAQ HTTP boundary.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not collapse readiness clarify/refuse/hedge into one generic copy block.
- must_not_generate: new decision names; new readiness states
- must_not_merge_with: leaf_paid_readiness_clarify_default, leaf_webhook_readiness_clarify
- test 状態: current=`yes` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_faq_compat_readiness_refuse
- parent_g3_unit: `g3_faq_compat_answer_unit`
- parent_g4_group: `g4_faq_compat_registry_slot`
- leaf_status: `generate`
- route責務: `POST /api/phaseLLM4/faq/answer`
- audience: `mixed` leak=`false`
- safety role: `warning`
- output shape: `refuse_text`
- source families: `answer_readiness_gate_templates`
- split reason: Readiness decisions have distinct selection nodes and output roles.
- must_keep_facts: Keep the refuse readiness decision text separate from allow-path answers.; Preserve readiness gate semantics at the FAQ HTTP boundary.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not collapse readiness clarify/refuse/hedge into one generic copy block.
- must_not_generate: new decision names; new readiness states
- must_not_merge_with: leaf_paid_readiness_clarify_default, leaf_webhook_readiness_clarify
- test 状態: current=`yes` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_faq_compat_readiness_hedge
- parent_g3_unit: `g3_faq_compat_answer_unit`
- parent_g4_group: `g4_faq_compat_registry_slot`
- leaf_status: `generate`
- route責務: `POST /api/phaseLLM4/faq/answer`
- audience: `mixed` leak=`false`
- safety role: `warning`
- output shape: `disclaimer_block`
- source families: `answer_readiness_gate_templates`
- split reason: Readiness decisions have distinct selection nodes and output roles.
- must_keep_facts: Keep the hedge readiness decision text separate from allow-path answers.; Preserve readiness gate semantics at the FAQ HTTP boundary.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not collapse readiness clarify/refuse/hedge into one generic copy block.
- must_not_generate: new decision names; new readiness states
- must_not_merge_with: leaf_paid_readiness_clarify_default, leaf_webhook_readiness_clarify
- test 状態: current=`yes` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

## g3_free_retrieval_search_unit
### leaf_free_retrieval_empty_reply
- parent_g3_unit: `g3_free_retrieval_search_unit`
- parent_g4_group: `g4_assistant_free_retrieval_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `fallback_text`
- source families: `free_retrieval_empty_reply`
- split reason: Empty-result branch differs from ranked-result and style shell branches.
- must_keep_facts: Keep not-found framing, narrowing guidance, and support fallback in one free retrieval empty-result response.; Preserve free-tier retrieval lane attribution.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not claim search succeeded when no candidates were found.
- must_not_generate: candidate citations; new paid upsell promises
- must_not_merge_with: leaf_free_retrieval_ranked_reply, leaf_free_style_quick
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`no`
- open questions: direct searchFaqFromKb ranked replyText assert remains weak elsewhere; empty branch exact strings are more stable

### leaf_free_retrieval_ranked_reply
- parent_g3_unit: `g3_free_retrieval_search_unit`
- parent_g4_group: `g4_assistant_free_retrieval_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- output shape: `ranked_answer_with_candidates`
- source families: `free_retrieval_ranked_reply`
- split reason: Ranked output has a different downstream contract envelope from empty replies and style shells.
- must_keep_facts: Keep candidate-ranking scaffold, citation headings, and Pro-support CTA sentence.; Preserve FAQ and CityPack candidate separation.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not convert ranked candidate output into deterministic final advice.
- must_not_generate: new citation fields; new candidate counts
- must_not_merge_with: leaf_free_retrieval_empty_reply, leaf_free_contextual_followup
- test 状態: current=`yes` exact=`no` route=`yes` shape=`yes` human_review=`yes`
- open questions: direct searchFaqFromKb ranked replyText exact assert remains weak

### leaf_free_style_quick
- parent_g3_unit: `g3_free_retrieval_search_unit`
- parent_g4_group: `g4_assistant_free_retrieval_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- output shape: `plain_text_answer`
- source families: `response_style_templates`
- split reason: Each style id is a distinct selection semantic cluster even when all output is text.
- must_keep_facts: Preserve the quick style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- must_not_generate: new style families; cross-style hybrid copy
- must_not_merge_with: leaf_free_retrieval_ranked_reply, leaf_free_contextual_followup
- test 状態: current=`yes` exact=`yes` route=`yes` shape=`no` human_review=`no`
- open questions: none

### leaf_free_style_coach
- parent_g3_unit: `g3_free_retrieval_search_unit`
- parent_g4_group: `g4_assistant_free_retrieval_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- output shape: `plain_text_answer`
- source families: `response_style_templates`
- split reason: Each style id is a distinct selection semantic cluster even when all output is text.
- must_keep_facts: Preserve the coach style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- must_not_generate: new style families; cross-style hybrid copy
- must_not_merge_with: leaf_free_retrieval_ranked_reply, leaf_free_contextual_followup
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`no`
- open questions: none

### leaf_free_style_checklist
- parent_g3_unit: `g3_free_retrieval_search_unit`
- parent_g4_group: `g4_assistant_free_retrieval_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- output shape: `plain_text_answer`
- source families: `response_style_templates`
- split reason: Each style id is a distinct selection semantic cluster even when all output is text.
- must_keep_facts: Preserve the checklist style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- must_not_generate: new style families; cross-style hybrid copy
- must_not_merge_with: leaf_free_retrieval_ranked_reply, leaf_free_contextual_followup
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`no`
- open questions: none

### leaf_free_style_choice
- parent_g3_unit: `g3_free_retrieval_search_unit`
- parent_g4_group: `g4_assistant_free_retrieval_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- output shape: `plain_text_answer`
- source families: `response_style_templates`
- split reason: Each style id is a distinct selection semantic cluster even when all output is text.
- must_keep_facts: Preserve the choice style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- must_not_generate: new style families; cross-style hybrid copy
- must_not_merge_with: leaf_free_retrieval_ranked_reply, leaf_free_contextual_followup
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`yes`
- open questions: Choice/Debug/Story style exact string asserts remain weak

### leaf_free_style_debug
- parent_g3_unit: `g3_free_retrieval_search_unit`
- parent_g4_group: `g4_assistant_free_retrieval_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- output shape: `plain_text_answer`
- source families: `response_style_templates`
- split reason: Each style id is a distinct selection semantic cluster even when all output is text.
- must_keep_facts: Preserve the debug style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- must_not_generate: new style families; cross-style hybrid copy
- must_not_merge_with: leaf_free_retrieval_ranked_reply, leaf_free_contextual_followup
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`yes`
- open questions: Choice/Debug/Story style exact string asserts remain weak

### leaf_free_style_timeline
- parent_g3_unit: `g3_free_retrieval_search_unit`
- parent_g4_group: `g4_assistant_free_retrieval_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- output shape: `plain_text_answer`
- source families: `response_style_templates`
- split reason: Each style id is a distinct selection semantic cluster even when all output is text.
- must_keep_facts: Preserve the timeline style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- must_not_generate: new style families; cross-style hybrid copy
- must_not_merge_with: leaf_free_retrieval_ranked_reply, leaf_free_contextual_followup
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`no`
- open questions: none

### leaf_free_style_weekend
- parent_g3_unit: `g3_free_retrieval_search_unit`
- parent_g4_group: `g4_assistant_free_retrieval_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- output shape: `plain_text_answer`
- source families: `response_style_templates`
- split reason: Each style id is a distinct selection semantic cluster even when all output is text.
- must_keep_facts: Preserve the weekend style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- must_not_generate: new style families; cross-style hybrid copy
- must_not_merge_with: leaf_free_retrieval_ranked_reply, leaf_free_contextual_followup
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`no`
- open questions: none

### leaf_free_style_story
- parent_g3_unit: `g3_free_retrieval_search_unit`
- parent_g4_group: `g4_assistant_free_retrieval_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- output shape: `plain_text_answer`
- source families: `response_style_templates`
- split reason: Each style id is a distinct selection semantic cluster even when all output is text.
- must_keep_facts: Preserve the story style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- must_not_generate: new style families; cross-style hybrid copy
- must_not_merge_with: leaf_free_retrieval_ranked_reply, leaf_free_contextual_followup
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`yes`
- open questions: Choice/Debug/Story style exact string asserts remain weak

## g3_free_contextual_followup_unit
### leaf_free_contextual_followup
- parent_g3_unit: `g3_free_contextual_followup_unit`
- parent_g4_group: `g4_assistant_free_contextual_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line free contextual followup`
- audience: `end_user` leak=`false`
- safety role: `faq`
- output shape: `plain_text_answer`
- source families: `free_contextual_followup_domain_answers`
- split reason: Current grouping keeps one contextual follow-up lane, but domain claims stay under human review.
- must_keep_facts: Keep free contextual follow-up answers tied to recent-domain resume logic.; Preserve domain-specific direct answer plus short follow-up question behavior.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge these direct answers with paid casual or paid domain ownership.
- must_not_generate: new unsupported domains
- must_not_merge_with: leaf_paid_casual, leaf_paid_domain_concierge
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`yes`
- open questions: housing/ssn/banking free contextual exact asserts remain weak

## g3_paid_casual_unit
### leaf_paid_casual
- parent_g3_unit: `g3_paid_casual_unit`
- parent_g4_group: `g4_assistant_paid_casual_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line paid casual`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `plain_text_answer`
- source families: `paid_casual_templates`
- split reason: Current runtime keeps one paid-casual family, but this leaf is marked for human review because several semantic clusters coexist.
- must_keep_facts: Keep greeting, smalltalk, general prompt, and domain-followup direct answers inside the paid casual lane.; Preserve concise paid casual posture and one-next-step framing.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not upgrade casual prompts into domain-concierge guarantees.
- must_not_generate: new direct-answer domains; new regulatory claims
- must_not_merge_with: leaf_paid_domain_concierge, leaf_paid_readiness_clarify_default
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`yes`
- open questions: none

## g3_paid_domain_answer_unit
### leaf_paid_domain_concierge
- parent_g3_unit: `g3_paid_domain_answer_unit`
- parent_g4_group: `g4_assistant_paid_domain_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line paid domain`
- audience: `end_user` leak=`false`
- safety role: `faq`
- output shape: `plain_text_answer`
- source families: `paid_domain_concierge_templates`
- split reason: Canonical grouping keeps this as one paid-domain answer owner, with human review because domains coexist.
- must_keep_facts: Keep domain-concierge answer envelope: summary, next step, pitfall, question, and follow-up variants.; Preserve paid domain lane ownership and do not collapse with safety or casual lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge domain concierge wording with runtime-knowledge fallback scaffolds.
- must_not_generate: new domain intents; new evidence promises
- must_not_merge_with: leaf_paid_casual, leaf_runtime_knowledge_fallback, leaf_paid_safety_core_facts_clarify
- test 状態: current=`yes` exact=`yes` route=`yes` shape=`no` human_review=`yes`
- open questions: none

### leaf_runtime_knowledge_fallback
- parent_g3_unit: `g3_paid_domain_answer_unit`
- parent_g4_group: `g4_assistant_paid_domain_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line paid domain`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `fallback_text`
- source families: `runtime_knowledge_fallback_templates`
- split reason: Runtime knowledge candidates are fallback content distinct from domain concierge answers.
- must_keep_facts: Keep synthetic knowledge-candidate fallback framing and short question prompts.; Preserve city/housing/followup/general slice behavior as fallback-only content.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not present synthetic knowledge fallback as confirmed live evidence.
- must_not_generate: new city-pack guarantees
- must_not_merge_with: leaf_paid_domain_concierge, leaf_free_retrieval_ranked_reply
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`yes`
- open questions: slice-specific runtime knowledge fallback exact lines remain weak

## g3_paid_conversation_format_unit
### leaf_paid_conversation_format_shell
- parent_g3_unit: `g3_paid_conversation_format_unit`
- parent_g4_group: `g4_assistant_paid_format_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line paid finalization`
- audience: `end_user` leak=`false`
- safety role: `faq`
- output shape: `plain_text_answer`
- source families: `paid_assistant_conversation_format`
- split reason: Formatting shell differs from guard fallback defaults.
- must_keep_facts: Keep the paid conversation shell headings and question line placeholders.; Preserve conversation-format ownership separate from semantic answer policy.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not remove or rename fixed shell sections without changing downstream contract.
- must_not_generate: new sections
- must_not_merge_with: leaf_paid_reply_guard_defaults, leaf_paid_domain_concierge
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`no`
- open questions: none

### leaf_paid_reply_guard_defaults
- parent_g3_unit: `g3_paid_conversation_format_unit`
- parent_g4_group: `g4_assistant_paid_format_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line paid finalization`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `fallback_text`
- source families: `paid_reply_guard_defaults`
- split reason: Guard defaults are fallback scaffolding, not the main format shell.
- must_keep_facts: Keep guard-level default lines used when main paid reply is empty or malformed.; Preserve reply-guard role separate from readiness/refuse decisions.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promote guard defaults into normal semantic answer copy.
- must_not_generate: legacy template terms
- must_not_merge_with: leaf_paid_conversation_format_shell, leaf_paid_finalizer_fallback
- test 状態: current=`yes` exact=`yes` route=`yes` shape=`no` human_review=`no`
- open questions: none

## g3_paid_disclaimer_unit
### leaf_paid_disclaimer
- parent_g3_unit: `g3_paid_disclaimer_unit`
- parent_g4_group: `g4_assistant_paid_safety_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line paid assistant`
- audience: `end_user` leak=`false`
- safety role: `disclaimer`
- output shape: `disclaimer_block`
- source families: `faq_disclaimer_templates`
- split reason: Same raw disclaimer family is reused across owners; paid purpose is a separate live leaf.
- must_keep_facts: Keep paid-assistant disclaimer and generic disclaimer fallback separate from FAQ disclaimer purposes.; Preserve paid-assistant route responsibility.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not substitute FAQ-purpose disclaimer into paid-assistant route.
- must_not_generate: policy-only operator disclaimers
- must_not_merge_with: leaf_faq_admin_disclaimer, leaf_faq_compat_disclaimer, leaf_policy_override_shadow
- test 状態: current=`yes` exact=`no` route=`yes` shape=`yes` human_review=`yes`
- open questions: generic disclaimer fallback branch exact wording assert remains weak

## g3_paid_safety_gate_unit
### leaf_paid_readiness_clarify_default
- parent_g3_unit: `g3_paid_safety_gate_unit`
- parent_g4_group: `g4_assistant_paid_safety_registry_slot`
- leaf_status: `generate`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `warning`
- output shape: `clarify_prompt`
- source families: `answer_readiness_gate_templates`
- split reason: Readiness defaults differ by decision node and output role.
- must_keep_facts: Keep readiness clarify/refuse/hedge defaults distinct by decision.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not collapse clarify, refuse, and hedge into one generic message.
- must_not_generate: new readiness states
- must_not_merge_with: leaf_paid_finalizer_clarify, leaf_webhook_readiness_clarify
- test 状態: current=`yes` exact=`no` route=`no` shape=`no` human_review=`no`
- open questions: none

### leaf_paid_readiness_refuse_default
- parent_g3_unit: `g3_paid_safety_gate_unit`
- parent_g4_group: `g4_assistant_paid_safety_registry_slot`
- leaf_status: `generate`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `warning`
- output shape: `refuse_text`
- source families: `answer_readiness_gate_templates`
- split reason: Readiness defaults differ by decision node and output role.
- must_keep_facts: Keep readiness clarify/refuse/hedge defaults distinct by decision.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not collapse clarify, refuse, and hedge into one generic message.
- must_not_generate: new readiness states
- must_not_merge_with: leaf_paid_finalizer_clarify, leaf_webhook_readiness_clarify
- test 状態: current=`yes` exact=`no` route=`no` shape=`no` human_review=`no`
- open questions: none

### leaf_paid_readiness_hedge_suffix
- parent_g3_unit: `g3_paid_safety_gate_unit`
- parent_g4_group: `g4_assistant_paid_safety_registry_slot`
- leaf_status: `generate`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `warning`
- output shape: `disclaimer_block`
- source families: `answer_readiness_gate_templates`
- split reason: Readiness defaults differ by decision node and output role.
- must_keep_facts: Keep readiness clarify/refuse/hedge defaults distinct by decision.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not collapse clarify, refuse, and hedge into one generic message.
- must_not_generate: new readiness states
- must_not_merge_with: leaf_paid_finalizer_clarify, leaf_webhook_readiness_clarify
- test 状態: current=`yes` exact=`no` route=`no` shape=`no` human_review=`no`
- open questions: none

### leaf_paid_safety_core_facts_clarify
- parent_g3_unit: `g3_paid_safety_gate_unit`
- parent_g4_group: `g4_assistant_paid_safety_registry_slot`
- leaf_status: `generate`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `clarify`
- output shape: `clarify_prompt`
- source families: `required_core_facts_domain_clarify`
- split reason: Required-core-facts gate is a separate decision stage from generic readiness and finalizer fallbacks.
- must_keep_facts: Keep required-core-facts clarify prompts as domain-sensitive safety prompts.; Preserve missing-critical-facts enforcement semantics.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not convert missing-facts clarify prompts into direct answers.
- must_not_generate: new mandatory fact categories
- must_not_merge_with: leaf_paid_verify_candidate_clarify, leaf_paid_domain_concierge
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`yes`
- open questions: none

### leaf_paid_verify_candidate_clarify
- parent_g3_unit: `g3_paid_safety_gate_unit`
- parent_g4_group: `g4_assistant_paid_safety_registry_slot`
- leaf_status: `generate`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `clarify`
- output shape: `clarify_prompt`
- source families: `verify_candidate_clarify_templates`
- split reason: Verify-candidate clarify is a distinct safety stage with its own prompt pool.
- must_keep_facts: Keep verify-candidate clarify variants as post-selection safety prompts.; Preserve repetition-avoidance and domain follow-up semantics.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not turn verify-candidate clarify prompts into definitive next steps.
- must_not_generate: new verify states
- must_not_merge_with: leaf_paid_safety_core_facts_clarify, leaf_paid_finalizer_clarify
- test 状態: current=`yes` exact=`no` route=`yes` shape=`yes` human_review=`yes`
- open questions: none

### leaf_paid_finalizer_fallback
- parent_g3_unit: `g3_paid_safety_gate_unit`
- parent_g4_group: `g4_assistant_paid_safety_registry_slot`
- leaf_status: `generate`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `fallback_text`
- source families: `finalize_candidate_fallback_templates`
- split reason: Finalizer fallback is separate from finalizer clarify/refuse outcomes.
- must_keep_facts: Keep empty-selected-reply fallback text separate from clarify/refuse overwrites.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.
- must_not_generate: new fallback reasons
- must_not_merge_with: leaf_paid_finalizer_clarify, leaf_paid_finalizer_refuse
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`no`
- open questions: none

### leaf_paid_finalizer_clarify
- parent_g3_unit: `g3_paid_safety_gate_unit`
- parent_g4_group: `g4_assistant_paid_safety_registry_slot`
- leaf_status: `generate`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `clarify`
- output shape: `clarify_prompt`
- source families: `finalize_candidate_fallback_templates`
- split reason: Finalizer clarify output has different selection semantics from empty fallback and refuse.
- must_keep_facts: Keep finalizer clarify defaults separate from generic fallback and refuse branches.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.
- must_not_generate: new clarify question types
- must_not_merge_with: leaf_paid_readiness_clarify_default, leaf_paid_finalizer_refuse
- test 状態: current=`yes` exact=`no` route=`yes` shape=`yes` human_review=`yes`
- open questions: none

### leaf_paid_finalizer_refuse
- parent_g3_unit: `g3_paid_safety_gate_unit`
- parent_g4_group: `g4_assistant_paid_safety_registry_slot`
- leaf_status: `generate`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `warning`
- output shape: `refuse_text`
- source families: `finalize_candidate_fallback_templates`
- split reason: Finalizer refuse output is a separate safety outcome.
- must_keep_facts: Keep finalizer refuse override separate from clarify and empty fallback defaults.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.
- must_not_generate: new refusal rationales
- must_not_merge_with: leaf_paid_finalizer_clarify, leaf_webhook_readiness_refuse
- test 状態: current=`yes` exact=`no` route=`yes` shape=`yes` human_review=`no`
- open questions: none

## g3_webhook_top_level_unit
### leaf_webhook_guard_missing_reply_fallback
- parent_g3_unit: `g3_webhook_top_level_unit`
- parent_g4_group: `g4_webhook_top_level_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `fallback_text`
- source families: `webhook_assistant_top_level_templates`
- split reason: Top-level webhook family mixes fallback, clarify/refuse, consent, and direct-command acknowledgements.
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- must_not_generate: new webhook commands
- must_not_merge_with: leaf_welcome_message, leaf_adjacent_emergency_message
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`no`
- open questions: none

### leaf_webhook_low_relevance_clarify
- parent_g3_unit: `g3_webhook_top_level_unit`
- parent_g4_group: `g4_webhook_top_level_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `clarify`
- output shape: `clarify_prompt`
- source families: `webhook_assistant_top_level_templates`
- split reason: Top-level webhook family mixes fallback, clarify/refuse, consent, and direct-command acknowledgements.
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- must_not_generate: new webhook commands
- must_not_merge_with: leaf_webhook_guard_missing_reply_fallback, leaf_welcome_message, leaf_adjacent_emergency_message
- test 状態: current=`yes` exact=`no` route=`yes` shape=`yes` human_review=`no`
- open questions: none

### leaf_webhook_retrieval_failure_fallback
- parent_g3_unit: `g3_webhook_top_level_unit`
- parent_g4_group: `g4_webhook_top_level_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `fallback_text`
- source families: `webhook_assistant_top_level_templates`
- split reason: Top-level webhook family mixes fallback, clarify/refuse, consent, and direct-command acknowledgements.
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- must_not_generate: new webhook commands
- must_not_merge_with: leaf_webhook_guard_missing_reply_fallback, leaf_welcome_message, leaf_adjacent_emergency_message
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`no`
- open questions: none

### leaf_webhook_readiness_clarify
- parent_g3_unit: `g3_webhook_top_level_unit`
- parent_g4_group: `g4_webhook_top_level_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `warning`
- output shape: `clarify_prompt`
- source families: `webhook_assistant_top_level_templates`
- split reason: Top-level webhook family mixes fallback, clarify/refuse, consent, and direct-command acknowledgements.
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- must_not_generate: new webhook commands
- must_not_merge_with: leaf_webhook_guard_missing_reply_fallback, leaf_welcome_message, leaf_adjacent_emergency_message
- test 状態: current=`yes` exact=`no` route=`yes` shape=`yes` human_review=`no`
- open questions: none

### leaf_webhook_readiness_refuse
- parent_g3_unit: `g3_webhook_top_level_unit`
- parent_g4_group: `g4_webhook_top_level_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `warning`
- output shape: `refuse_text`
- source families: `webhook_assistant_top_level_templates`
- split reason: Top-level webhook family mixes fallback, clarify/refuse, consent, and direct-command acknowledgements.
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- must_not_generate: new webhook commands
- must_not_merge_with: leaf_webhook_guard_missing_reply_fallback, leaf_welcome_message, leaf_adjacent_emergency_message
- test 状態: current=`yes` exact=`no` route=`yes` shape=`yes` human_review=`no`
- open questions: none

### leaf_webhook_synthetic_ack
- parent_g3_unit: `g3_webhook_top_level_unit`
- parent_g4_group: `g4_webhook_top_level_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `command_ack`
- source families: `webhook_assistant_top_level_templates`
- split reason: Top-level webhook family mixes fallback, clarify/refuse, consent, and direct-command acknowledgements.
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- must_not_generate: new webhook commands
- must_not_merge_with: leaf_webhook_guard_missing_reply_fallback, leaf_welcome_message, leaf_adjacent_emergency_message
- test 状態: current=`yes` exact=`no` route=`yes` shape=`yes` human_review=`no`
- open questions: none

### leaf_webhook_consent_state_ack
- parent_g3_unit: `g3_webhook_top_level_unit`
- parent_g4_group: `g4_webhook_top_level_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `consent_ack`
- source families: `webhook_assistant_top_level_templates`
- split reason: Top-level webhook family mixes fallback, clarify/refuse, consent, and direct-command acknowledgements.
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- must_not_generate: new webhook commands
- must_not_merge_with: leaf_webhook_guard_missing_reply_fallback, leaf_welcome_message, leaf_adjacent_emergency_message
- test 状態: current=`yes` exact=`no` route=`yes` shape=`no` human_review=`no`
- open questions: none

### leaf_webhook_direct_command_ack
- parent_g3_unit: `g3_webhook_top_level_unit`
- parent_g4_group: `g4_webhook_top_level_registry_slot`
- leaf_status: `generate`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `command_ack`
- source families: `webhook_assistant_top_level_templates`
- split reason: Top-level webhook family mixes fallback, clarify/refuse, consent, and direct-command acknowledgements.
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- must_not_generate: new webhook commands
- must_not_merge_with: leaf_webhook_guard_missing_reply_fallback, leaf_welcome_message, leaf_adjacent_emergency_message
- test 状態: current=`yes` exact=`no` route=`yes` shape=`yes` human_review=`no`
- open questions: none

## g3_welcome_message_unit
### leaf_welcome_message
- parent_g3_unit: `g3_welcome_message_unit`
- parent_g4_group: `g4_notification_registry_slot`
- leaf_status: `generate`
- route責務: `welcome push flow`
- audience: `end_user` leak=`false`
- safety role: `notification`
- output shape: `welcome_text`
- source families: `welcome_message`
- split reason: Single-family notification trigger.
- must_keep_facts: Keep one-time welcome notification wording and official-contact framing.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.
- must_not_generate: new onboarding steps
- must_not_merge_with: leaf_journey_reminder_message, leaf_webhook_synthetic_ack
- test 状態: current=`yes` exact=`no` route=`no` shape=`yes` human_review=`no`
- open questions: none

## g3_line_renderer_service_fallback_unit
### leaf_line_renderer_overflow_summary
- parent_g3_unit: `g3_line_renderer_service_fallback_unit`
- parent_g4_group: `g4_line_renderer_fallback_registry_slot`
- leaf_status: `generate`
- route責務: `renderer fallback`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `renderer_default_text`
- source families: `line_surface_renderer_defaults`
- split reason: Renderer defaults split by output circumstance: overflow, deeplink, service ack, headers, or failure.
- must_keep_facts: Keep renderer-service fallback wording separate from assistant answer content.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new LINE surface types or routing promises.
- must_not_generate: new renderer states
- must_not_merge_with: leaf_notification_body_default, leaf_webhook_guard_missing_reply_fallback
- test 状態: current=`yes` exact=`no` route=`no` shape=`yes` human_review=`no`
- open questions: none

### leaf_line_renderer_deeplink_with_url
- parent_g3_unit: `g3_line_renderer_service_fallback_unit`
- parent_g4_group: `g4_line_renderer_fallback_registry_slot`
- leaf_status: `generate`
- route責務: `renderer fallback`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `renderer_default_text`
- source families: `line_surface_renderer_defaults`
- split reason: Renderer defaults split by output circumstance: overflow, deeplink, service ack, headers, or failure.
- must_keep_facts: Keep renderer-service fallback wording separate from assistant answer content.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new LINE surface types or routing promises.
- must_not_generate: new renderer states
- must_not_merge_with: leaf_notification_body_default, leaf_webhook_guard_missing_reply_fallback
- test 状態: current=`yes` exact=`no` route=`no` shape=`yes` human_review=`no`
- open questions: none

### leaf_line_renderer_deeplink_generic
- parent_g3_unit: `g3_line_renderer_service_fallback_unit`
- parent_g4_group: `g4_line_renderer_fallback_registry_slot`
- leaf_status: `generate`
- route責務: `renderer fallback`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `renderer_default_text`
- source families: `line_surface_renderer_defaults`
- split reason: Renderer defaults split by output circumstance: overflow, deeplink, service ack, headers, or failure.
- must_keep_facts: Keep renderer-service fallback wording separate from assistant answer content.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new LINE surface types or routing promises.
- must_not_generate: new renderer states
- must_not_merge_with: leaf_notification_body_default, leaf_webhook_guard_missing_reply_fallback
- test 状態: current=`yes` exact=`no` route=`no` shape=`yes` human_review=`no`
- open questions: none

### leaf_line_renderer_service_ack
- parent_g3_unit: `g3_line_renderer_service_fallback_unit`
- parent_g4_group: `g4_line_renderer_fallback_registry_slot`
- leaf_status: `generate`
- route責務: `renderer fallback`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `renderer_default_text`
- source families: `line_surface_renderer_defaults`
- split reason: Renderer defaults split by output circumstance: overflow, deeplink, service ack, headers, or failure.
- must_keep_facts: Keep renderer-service fallback wording separate from assistant answer content.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new LINE surface types or routing promises.
- must_not_generate: new renderer states
- must_not_merge_with: leaf_notification_body_default, leaf_webhook_guard_missing_reply_fallback
- test 状態: current=`yes` exact=`no` route=`no` shape=`yes` human_review=`no`
- open questions: none

### leaf_line_renderer_generic_headers
- parent_g3_unit: `g3_line_renderer_service_fallback_unit`
- parent_g4_group: `g4_line_renderer_fallback_registry_slot`
- leaf_status: `generate`
- route責務: `renderer fallback`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `renderer_default_text`
- source families: `line_surface_renderer_defaults`
- split reason: Renderer defaults split by output circumstance: overflow, deeplink, service ack, headers, or failure.
- must_keep_facts: Keep renderer-service fallback wording separate from assistant answer content.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new LINE surface types or routing promises.
- must_not_generate: new renderer states
- must_not_merge_with: leaf_notification_body_default, leaf_webhook_guard_missing_reply_fallback
- test 状態: current=`yes` exact=`no` route=`no` shape=`yes` human_review=`yes`
- open questions: none

### leaf_line_renderer_render_failure
- parent_g3_unit: `g3_line_renderer_service_fallback_unit`
- parent_g4_group: `g4_line_renderer_fallback_registry_slot`
- leaf_status: `generate`
- route責務: `renderer fallback`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `renderer_default_text`
- source families: `line_surface_renderer_defaults`
- split reason: Renderer defaults split by output circumstance: overflow, deeplink, service ack, headers, or failure.
- must_keep_facts: Keep renderer-service fallback wording separate from assistant answer content.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new LINE surface types or routing promises.
- must_not_generate: new renderer states
- must_not_merge_with: leaf_notification_body_default, leaf_webhook_guard_missing_reply_fallback
- test 状態: current=`yes` exact=`no` route=`no` shape=`yes` human_review=`no`
- open questions: none

## g3_notification_renderer_unit
### leaf_notification_body_default
- parent_g3_unit: `g3_notification_renderer_unit`
- parent_g4_group: `g4_notification_registry_slot`
- leaf_status: `generate`
- route責務: `notification sender`
- audience: `end_user` leak=`false`
- safety role: `notification`
- output shape: `notification_text`
- source families: `notification_renderer_defaults`
- split reason: Notification renderer mixes body fallback, alt-text fallback, and CTA text-join concerns.
- must_keep_facts: Keep notification renderer defaults separate from source notification title/body content.; Preserve text-mode CTA join semantics when template buttons are unavailable.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not invent CTA URLs or button counts.
- must_not_generate: new renderer fallback reasons
- must_not_merge_with: leaf_line_renderer_service_ack, leaf_ops_escalation_button_isolate
- test 状態: current=`yes` exact=`no` route=`no` shape=`yes` human_review=`no`
- open questions: none

### leaf_notification_alt_text_default
- parent_g3_unit: `g3_notification_renderer_unit`
- parent_g4_group: `g4_notification_registry_slot`
- leaf_status: `generate`
- route責務: `notification sender`
- audience: `end_user` leak=`false`
- safety role: `label`
- output shape: `unknown_shape`
- source families: `notification_renderer_defaults`
- split reason: Notification renderer mixes body fallback, alt-text fallback, and CTA text-join concerns.
- must_keep_facts: Keep notification renderer defaults separate from source notification title/body content.; Preserve text-mode CTA join semantics when template buttons are unavailable.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not invent CTA URLs or button counts.
- must_not_generate: new renderer fallback reasons
- must_not_merge_with: leaf_line_renderer_service_ack, leaf_ops_escalation_button_isolate
- test 状態: current=`yes` exact=`yes` route=`no` shape=`unknown` human_review=`yes`
- open questions: none

### leaf_notification_textmode_cta_join
- parent_g3_unit: `g3_notification_renderer_unit`
- parent_g4_group: `g4_notification_registry_slot`
- leaf_status: `generate`
- route責務: `notification sender`
- audience: `end_user` leak=`false`
- safety role: `cta`
- output shape: `notification_text`
- source families: `notification_renderer_defaults`
- split reason: Notification renderer mixes body fallback, alt-text fallback, and CTA text-join concerns.
- must_keep_facts: Keep notification renderer defaults separate from source notification title/body content.; Preserve text-mode CTA join semantics when template buttons are unavailable.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not invent CTA URLs or button counts.
- must_not_generate: new renderer fallback reasons
- must_not_merge_with: leaf_line_renderer_service_ack, leaf_ops_escalation_button_isolate
- test 状態: current=`yes` exact=`no` route=`no` shape=`yes` human_review=`no`
- open questions: none

## g3_journey_direct_command_unit
### leaf_region_prompt_or_validation
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `clarify`
- output shape: `clarify_prompt`
- source families: `region_line_messages`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`no`
- open questions: none

### leaf_region_state_ack
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `cta`
- output shape: `command_ack`
- source families: `region_line_messages`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`no`
- open questions: none

### leaf_citypack_feedback_received
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `cta`
- output shape: `command_ack`
- source families: `citypack_feedback_messages`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`no`
- open questions: none

### leaf_citypack_feedback_usage
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `clarify`
- output shape: `clarify_prompt`
- source families: `citypack_feedback_messages`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`no`
- open questions: none

### leaf_redac_membership_status
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `cta`
- output shape: `command_ack`
- source families: `redac_membership_messages`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_redac_membership_guidance
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `clarify`
- output shape: `clarify_prompt`
- source families: `redac_membership_messages`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_redac_membership_unavailable
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `fallback_text`
- source families: `redac_membership_messages`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_journey_command_validation
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `clarify`
- output shape: `clarify_prompt`
- source families: `journey_command_replies`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_journey_command_state_ack
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `cta`
- output shape: `command_ack`
- source families: `journey_command_replies`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_journey_command_feature_paused
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- output shape: `fallback_text`
- source families: `journey_command_replies`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_journey_command_support_open
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `cta`
- output shape: `command_ack`
- source families: `journey_command_replies`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_journey_command_citypack_subscription
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `cta`
- output shape: `command_ack`
- source families: `journey_command_replies`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_journey_command_todo_status
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `cta`
- output shape: `command_ack`
- source families: `journey_command_replies`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_journey_command_guidance_hints
- parent_g3_unit: `g3_journey_direct_command_unit`
- parent_g4_group: `g4_journey_text_registry_slot`
- leaf_status: `generate`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `clarify`
- output shape: `clarify_prompt`
- source families: `journey_command_replies`
- split reason: Journey direct command lane separates validation, ack, paused-state, and help clusters to keep output shape stable.
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- must_not_generate: new command verbs
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

## g3_journey_task_surface_unit
### leaf_task_detail_defaults_isolate
- parent_g3_unit: `g3_journey_task_surface_unit`
- parent_g4_group: `g4_journey_task_registry_slot`
- leaf_status: `isolate_for_human_or_separate_policy`
- route責務: `journey task detail and postback`
- audience: `end_user` leak=`true`
- safety role: `mixed`
- output shape: `unknown_shape`
- source families: `journey_task_detail_defaults`
- split reason: Audience leak + mixed fallback/header/continuation blocks.
- must_keep_facts: Keep this family isolated from normal end-user generation guidance because admin-facing wording is present.; Preserve leak visibility instead of normalizing it away.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not treat Task Detail Editor wording as a normal user-facing copy target.
- must_not_generate: live normative guidance copy
- must_not_merge_with: leaf_task_flex_labels, leaf_task_flex_buttons, leaf_journey_reminder_message
- test 状態: current=`no` exact=`no` route=`no` shape=`unknown` human_review=`yes`
- open questions: none

### leaf_task_flex_labels
- parent_g3_unit: `g3_journey_task_surface_unit`
- parent_g4_group: `g4_journey_task_registry_slot`
- leaf_status: `generate`
- route責務: `journey task detail and postback`
- audience: `end_user` leak=`false`
- safety role: `label`
- output shape: `flex_label_set`
- source families: `task_flex_labels_and_buttons`
- split reason: Flex labels are a separate shape from buttons and leak-prone task detail text.
- must_keep_facts: Keep fixed section labels, headings, and card titles in the task flex surface.; Preserve task-flex ownership and do not merge with task-detail leak copy.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not invent new task sections or card titles.
- must_not_generate: new flex sections
- must_not_merge_with: leaf_task_flex_buttons, leaf_task_detail_defaults_isolate
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`no`
- open questions: none

### leaf_task_flex_buttons
- parent_g3_unit: `g3_journey_task_surface_unit`
- parent_g4_group: `g4_journey_task_registry_slot`
- leaf_status: `generate`
- route責務: `journey task detail and postback`
- audience: `end_user` leak=`false`
- safety role: `button`
- output shape: `flex_button_set`
- source families: `task_flex_labels_and_buttons`
- split reason: Buttons require their own output shape and downstream action contract.
- must_keep_facts: Keep task-flex button labels and link-opening CTA labels fixed.; Preserve understanding-manual/video/failure action semantics.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not invent new task-detail postback actions or video assumptions.
- must_not_generate: new button counts
- must_not_merge_with: leaf_task_flex_labels, leaf_notification_textmode_cta_join
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`no`
- open questions: none

### leaf_blocked_reason_labels
- parent_g3_unit: `g3_journey_task_surface_unit`
- parent_g4_group: `g4_journey_task_registry_slot`
- leaf_status: `generate`
- route責務: `journey task detail and postback`
- audience: `end_user` leak=`false`
- safety role: `label`
- output shape: `unknown_shape`
- source families: `blocked_reason_labels`
- split reason: Status labels are neither task-detail leak copy nor flex button labels.
- must_keep_facts: Keep blocked reason Japanese label mapping stable.; Preserve task-status label semantics without adding new blockers.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.
- must_not_generate: new blocker codes
- must_not_merge_with: leaf_task_detail_defaults_isolate, leaf_task_flex_labels
- test 状態: current=`no` exact=`no` route=`no` shape=`unknown` human_review=`yes`
- open questions: none

## g3_journey_reminder_unit
### leaf_journey_reminder_message
- parent_g3_unit: `g3_journey_reminder_unit`
- parent_g4_group: `g4_notification_registry_slot`
- leaf_status: `isolate_for_human_or_separate_policy`
- route責務: `internal reminder jobs`
- audience: `end_user` leak=`true`
- safety role: `notification`
- output shape: `reminder_text`
- source families: `journey_reminder_message`
- split reason: Audience leak candidate with internal-job framing.
- must_keep_facts: Keep this reminder copy isolated because trigger metadata and internal framing are present.; Preserve TODO key/title/due date/CTA/trigger fields as observed.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not normalize internal trigger framing into a generic end-user reminder leaf.
- must_not_generate: normal guidance copy
- must_not_merge_with: leaf_welcome_message, leaf_notification_body_default
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

## g3_adjacent_emergency_unit
### leaf_adjacent_emergency_message
- parent_g3_unit: `g3_adjacent_emergency_unit`
- parent_g4_group: `g4_adjacent_ops_registry_slot`
- leaf_status: `generate`
- route責務: `internal emergency jobs`
- audience: `mixed` leak=`false`
- safety role: `warning`
- output shape: `notification_text`
- source families: `emergency_message_template`
- split reason: Adjacent runtime remains separate from main assistant and notification lanes.
- must_keep_facts: Keep severity, headline, region, category, and official-source confirmation line.; Preserve adjacent emergency runtime ownership.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge emergency bulletin wording into assistant or journey surfaces.
- must_not_generate: new emergency policy
- must_not_merge_with: leaf_ops_escalation_body_isolate, leaf_webhook_readiness_refuse
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

## g3_adjacent_ops_notification_unit
### leaf_ops_escalation_title_isolate
- parent_g3_unit: `g3_adjacent_ops_notification_unit`
- parent_g4_group: `g4_adjacent_ops_registry_slot`
- leaf_status: `isolate_for_human_or_separate_policy`
- route責務: `phase33 ops decision execute`
- audience: `mixed` leak=`true`
- safety role: `label`
- output shape: `unknown_shape`
- source families: `ops_escalation_default_notification`
- split reason: Title, body, and button roles are distinct and leak-prone.
- must_keep_facts: Keep ops escalation wording isolated because operator framing is present.; Preserve adjacent-ops runtime ownership.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not fold ops escalation defaults into normal end-user notification copy.
- must_not_generate: live normative end-user copy
- must_not_merge_with: leaf_notification_body_default, leaf_adjacent_emergency_message
- test 状態: current=`no` exact=`no` route=`no` shape=`unknown` human_review=`yes`
- open questions: none

### leaf_ops_escalation_body_isolate
- parent_g3_unit: `g3_adjacent_ops_notification_unit`
- parent_g4_group: `g4_adjacent_ops_registry_slot`
- leaf_status: `isolate_for_human_or_separate_policy`
- route責務: `phase33 ops decision execute`
- audience: `mixed` leak=`true`
- safety role: `notification`
- output shape: `operator_notification_text`
- source families: `ops_escalation_default_notification`
- split reason: Title, body, and button roles are distinct and leak-prone.
- must_keep_facts: Keep ops escalation wording isolated because operator framing is present.; Preserve adjacent-ops runtime ownership.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not fold ops escalation defaults into normal end-user notification copy.
- must_not_generate: live normative end-user copy
- must_not_merge_with: leaf_notification_body_default, leaf_adjacent_emergency_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

### leaf_ops_escalation_button_isolate
- parent_g3_unit: `g3_adjacent_ops_notification_unit`
- parent_g4_group: `g4_adjacent_ops_registry_slot`
- leaf_status: `isolate_for_human_or_separate_policy`
- route責務: `phase33 ops decision execute`
- audience: `mixed` leak=`true`
- safety role: `button`
- output shape: `flex_button_set`
- source families: `ops_escalation_default_notification`
- split reason: Title, body, and button roles are distinct and leak-prone.
- must_keep_facts: Keep ops escalation wording isolated because operator framing is present.; Preserve adjacent-ops runtime ownership.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not fold ops escalation defaults into normal end-user notification copy.
- must_not_generate: live normative end-user copy
- must_not_merge_with: leaf_notification_body_default, leaf_adjacent_emergency_message
- test 状態: current=`no` exact=`no` route=`no` shape=`no` human_review=`yes`
- open questions: none

## g3_policy_override_shadow_unit
### leaf_policy_override_shadow
- parent_g3_unit: `g3_policy_override_shadow_unit`
- parent_g4_group: `g4_policy_shadow_registry_slot`
- leaf_status: `exclude_shadow`
- route責務: `ops config policy path`
- audience: `operator` leak=`true`
- safety role: `disclaimer`
- output shape: `unknown_shape`
- source families: `policy_override_disclaimer_templates`
- split reason: Special obligation: policy override must remain shadow and excluded.
- must_keep_facts: Keep policy override disclaimer templates out of live generation targets until runtime delivery is observed.
- prohibited_claims: Do not promote this shadow unit to reachable.; Do not merge policy override disclaimer into live FAQ or paid disclaimer leaves.
- must_not_generate: any live copy apply
- must_not_merge_with: leaf_faq_admin_disclaimer, leaf_faq_compat_disclaimer, leaf_paid_disclaimer
- test 状態: current=`yes` exact=`no` route=`yes` shape=`unknown` human_review=`yes`
- open questions: none

## g3_dead_shadow_unit
### leaf_search_kb_replytext_shadow
- parent_g3_unit: `g3_dead_shadow_unit`
- parent_g4_group: `g4_dead_shadow_registry_slot`
- leaf_status: `exclude_shadow`
- route責務: `shadow only`
- audience: `unknown` leak=`false`
- safety role: `faq`
- output shape: `unknown_shape`
- source families: `search_kb_replytext_templates`
- split reason: Dead/test-only helper text is outside live manifest scope.
- must_keep_facts: Keep search helper replyText outside live generation targets.
- prohibited_claims: Do not treat this helper text as a live runtime answer surface.
- must_not_generate: live copy
- must_not_merge_with: leaf_free_retrieval_ranked_reply
- test 状態: current=`yes` exact=`no` route=`yes` shape=`unknown` human_review=`yes`
- open questions: none

### leaf_paid_assistant_legacy_shadow
- parent_g3_unit: `g3_dead_shadow_unit`
- parent_g4_group: `g4_dead_shadow_registry_slot`
- leaf_status: `exclude_shadow`
- route責務: `shadow only`
- audience: `unknown` leak=`false`
- safety role: `faq`
- output shape: `unknown_shape`
- source families: `paid_assistant_legacy_structured_format`
- split reason: Legacy structured formatter is dead/test-only on the main runtime path.
- must_keep_facts: Keep legacy paid formatter copy excluded from live generation targets.
- prohibited_claims: Do not treat the legacy formatter as current main-path output.
- must_not_generate: live copy
- must_not_merge_with: leaf_paid_conversation_format_shell
- test 状態: current=`yes` exact=`yes` route=`yes` shape=`unknown` human_review=`yes`
- open questions: none

## not_observed
### leaf_future_quick_reply_surface_slot
- parent_g3_unit: `not_observed`
- parent_g4_group: `g4_dynamic_quick_reply_surface_slot`
- leaf_status: `unknown`
- route責務: `future surface slot only`
- audience: `unknown` leak=`false`
- safety role: `unknown`
- output shape: `unknown_shape`
- source families: `none`
- split reason: Special obligation: preserve quick-reply not-observed status without treating the surface as absent.
- must_keep_facts: Standalone preset runtime-connected quick reply family was not observed in this snapshot.
- prohibited_claims: Do not write that quick reply is absent from the product.; Do not promote a future slot into a live generation target.
- must_not_generate: live quick reply copy
- must_not_merge_with: leaf_notification_textmode_cta_join
- test 状態: current=`no` exact=`yes` route=`yes` shape=`yes` human_review=`yes`
- open questions: Which runtime route emits dynamic quick reply surfaces, if any, remains outside this preset audit.
