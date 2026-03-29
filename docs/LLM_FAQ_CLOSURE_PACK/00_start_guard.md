# 00 Start Guard

## Commands
```bash
git -C "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001" branch --show-current
git -C "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001" rev-parse HEAD
git -C "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001" rev-parse --short HEAD
git -C "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001" status -sb
ls -la "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_DRAFT_APPLY_GATE"
ls -la "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_LEAF_DRAFT_CORPUS"
```

## Observed
- repo_root: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001`
- branch: `detached HEAD`
- HEAD: `834eaf010876a6c08d21efd38a0e135df7987cb4`
- short HEAD: `834eaf01`
- status -sb:
```text
## HEAD (no branch)
?? docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/
?? docs/LLM_FAQ_DRAFT_APPLY_GATE/
?? docs/LLM_FAQ_LEAF_DRAFT_CORPUS/
?? docs/LLM_FAQ_LEAF_MANIFEST/
?? docs/LLM_FAQ_TEMPLATE_AUDIT/
```

## Required Artifacts
- `apply:08_apply_readiness_partition.md`: `true`
- `apply:09_apply_readiness_partition.csv`: `true`
- `apply:10_safe_minimum_apply_candidates.md`: `true`
- `apply:11_safe_minimum_apply_candidates.json`: `true`
- `apply:12_blocked_apply_queue.csv`: `true`
- `apply:13_missing_binding_questions.md`: `true`
- `apply:14_risk_register.md`: `true`
- `draft:04_leaf_draft_corpus.json`: `true`
- `draft:05_leaf_draft_corpus.md`: `true`
- `draft:06_leaf_draft_corpus.csv`: `true`
- `draft:07_deferred_review_queue.csv`: `true`
- `draft:08_excluded_queue.csv`: `true`
- `draft:10_risk_notes.md`: `true`
- `draft:11_open_questions.md`: `true`
- `leaf:05_leaf_manifest.json`: `true`
- `leaf:06_leaf_manifest.csv`: `true`
- `leaf:07_leaf_to_route_mapping.csv`: `true`
- `leaf:08_leaf_to_generation_scope.csv`: `true`
- `leaf:09_output_shape_matrix.md`: `true`
- `leaf:10_test_anchor_matrix.md`: `true`
- `grouping:05_canonical_grouping_spec.json`: `true`
- `grouping:09_gpt_handoff_units.md`: `true`
- `grouping:11_template_to_group_mapping.csv`: `true`
- `grouping:12_route_to_group_mapping.csv`: `true`

## Integrated Spec Discovery
- found: `True`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/Member_LLM_Integrated_Spec_V1.md`
