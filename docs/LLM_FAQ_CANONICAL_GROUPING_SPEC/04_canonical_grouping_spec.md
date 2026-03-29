# 04 Canonical Grouping Spec

This is the primary human-readable canonical grouping specification for the audited LLM and FAQ user-facing template estate.

## Layer Model

- G0 preserves the audited 32 raw families exactly.
- G1 groups by current runtime lane.
- G2 groups by recommended canonical owner for future copy SSOT.
- G3 groups by future GPT handoff unit.
- G4 groups by future add-only registry slot readiness.

## Hard No-Merge Principles

- route responsibility differs
- selector predicates or decision nodes differ
- safety role differs
- audience differs or audience leak risk exists
- live vs shadow runtime truth differs
- assistant runtime and adjacent runtime differ

## Special Classes

- `policy_override_disclaimer_templates`: shadow policy class, unconfirmed
- `search_kb_replytext_templates`: dead or test-only shadow class
- `paid_assistant_legacy_structured_format`: dead or test-only shadow class
- standalone preset runtime-connected quick reply family: not observed; keep visible as a special future slot, not a live group

## See Also

- /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/04_runtime_lane_groups.md
- /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/05_canonical_owner_groups.md
- /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/06_no_merge_boundaries.md
- /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/07_surface_audience_matrix.md
- /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/08_safety_boundary_matrix.md
- /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/09_gpt_handoff_units.md
- /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/05_canonical_grouping_spec.json

## Artifact authority

- `05_canonical_grouping_spec.json` is the primary machine-readable canonical grouping artifact.
- `10_canonical_grouping_spec.json` is a mirror artifact and must be regenerated from `05`.
- mirror-only edits are not allowed.
- drift guard and lock file:
  - /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/17_artifact_authority_and_drift_guard.md
  - /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/18_primary_mirror_lock.json
