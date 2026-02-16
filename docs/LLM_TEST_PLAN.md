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

## Manual Checks
- Admin ops console shows llmExplanation JSON and status without affecting ops decisions.
- When LLM_FEATURE_FLAG is off, explanation remains fallback and advisory-only.
