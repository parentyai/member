# 15 Exec Summary

## What this spec does

- Reuses the existing canonical grouping spec directory by explicit user instruction.
- Validates the prior audit facts against the current audit artifacts.
- Defines G0 to G4 grouping without changing runtime code, tests, or existing docs.
- Freezes shadow classes, audience leaks, no-merge boundaries, and GPT handoff units.

## Key numbers

- raw families (G0): 32
- exact text blocks: 319
- runtime lanes (G1): 12
- canonical owner groups (G2): 14
- GPT handoff units (G3): 20
- future registry slot groups (G4): 17

## Key decisions

- `policy_override_disclaimer_templates` remains a shadow policy group and never merges into live disclaimers.
- `search_kb_replytext_templates` and `paid_assistant_legacy_structured_format` remain dead/test shadow groups.
- standalone preset runtime-connected quick reply family remains not observed and is represented only as a future surface slot candidate.
- audience leak candidates stay explicit and are not normalized away.
- same-copy different-route cases stay split by route responsibility, owner, and safety boundary.

## Primary outputs

- /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/04_canonical_grouping_spec.md
- /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/05_canonical_grouping_spec.json

## Artifact authority and drift prevention

- primary machine-readable artifact: 
  - /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/05_canonical_grouping_spec.json
- mirror machine-readable artifact:
  - /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/10_canonical_grouping_spec.json
- governance references:
  - /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/17_artifact_authority_and_drift_guard.md
  - /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/18_primary_mirror_lock.json
