# LLM_TEST_PLAN

## Scope
- Advisory-only LLM integration (read-only).
- Fail-closed behavior, allow-list, schema validation, and audit traceability.

## Core Tests
- disabled-by-default: LLM_FEATURE_FLAG off => fallback response
  - tests/phaseLLM1/phaseLLM1_feature_flag.test.js
  - tests/phaseLLM2/phaseLLM2_ops_explanation_usecase.test.js
- allow-list enforcement: non-allow-list fields are rejected
  - tests/phaseLLM1/phaseLLM1_allow_list.test.js
- schema validation: OpsExplanation/NextActionCandidates/FAQAnswer
  - tests/phaseLLM1/phaseLLM1_schema_validation.test.js
  - tests/phaseLLM2/phaseLLM2_ops_explanation_usecase.test.js
- admin UI wiring: ops_readonly includes ops-explain display
  - tests/phaseLLM2/phaseLLM2_ops_explanation_ui.test.js
- next action candidates: abstract actions only + fallback on invalid schema
  - tests/phaseLLM3/phaseLLM3_next_action_candidates_usecase.test.js
- admin UI wiring: ops_readonly includes next action candidates display
  - tests/phaseLLM3/phaseLLM3_next_action_candidates_ui.test.js
- FAQ answer: direct URL blocked + citation sourceId enforcement
  - tests/phaseLLM4/phaseLLM4_faq_usecase.test.js
- runbook + phase plan docs exist
  - tests/phaseLLM5/phaseLLM5_docs_exist.test.js

## Manual Checks
- Admin ops console shows llmExplanation JSON and status without affecting ops decisions.
- When LLM_FEATURE_FLAG is off, explanation remains fallback and advisory-only.

## Phase208 Additions
- dual gate: `system_flags.llmEnabled` and `LLM_FEATURE_FLAG` both required
  - tests/phaseLLM6/phaseLLM6_dual_gate.test.js
- FAQ KB-only: candidates 0 or citations 0 => 422 BLOCK
  - tests/phaseLLM6/phaseLLM6_faq_blocks_without_citations.test.js
  - tests/phaseLLM6/phaseLLM6_faq_blocks_kb_no_match.test.js
- FAQ link safety:
  - direct URL forbidden
  - WARN link blocked
  - tests/phaseLLM6/phaseLLM6_faq_link_safety.test.js
- minimization: Secret/PII not allowed into LLM payload
  - tests/phaseLLM6/phaseLLM6_allowlist_prevents_secret.test.js
- audit traceability: blocked/success both append trace-linked audit logs
  - tests/phaseLLM6/phaseLLM6_audit_trace_required.test.js

## Phase731-733 Additions
- paid orchestrator strategy:
  - greeting/casual stays retrieval-free
  - broad paid question prefers `clarify`
  - domain intent stays `domain_concierge`
  - tests/phase731/phase731_t01_paid_orchestrator_strategy_contract.test.js
- paid orchestrator execution:
  - judge rejects legacy template candidates
  - verifier softens or clarifies weak evidence
  - tests/phase731/phase731_t02_paid_orchestrator_run_contract.test.js
  - tests/phase732/phase732_t01_candidate_judge_verifier_contract.test.js
- webhook wiring:
  - `ENABLE_PAID_ORCHESTRATOR_V2` keeps rollout behind a dedicated flag
  - tests/phase731/phase731_t03_webhook_paid_orchestrator_wiring_contract.test.js
- action telemetry:
  - `strategy/retrievalQuality/judgeWinner/judgeScores/verificationOutcome/contradictionFlags/candidateCount`
  - tests/phase732/phase732_t02_llm_action_orchestrator_telemetry_contract.test.js
- offline golden eval:
  - paid natural reply constraints remain fixture-verifiable
  - tests/phase733/phase733_t01_paid_golden_eval_contract.test.js
