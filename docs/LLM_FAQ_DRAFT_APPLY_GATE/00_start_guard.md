# 00 Start Guard

## Commands
```bash
git -C "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001" branch --show-current
git -C "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001" rev-parse HEAD
git -C "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001" rev-parse --short HEAD
git -C "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001" status -sb
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
?? docs/LLM_FAQ_LEAF_DRAFT_CORPUS/
?? docs/LLM_FAQ_LEAF_MANIFEST/
?? docs/LLM_FAQ_TEMPLATE_AUDIT/
```

## Required Artifact Presence
- `04_leaf_draft_corpus.json`: `present`
- `05_leaf_draft_corpus.md`: `present`
- `06_leaf_draft_corpus.csv`: `present`
- `07_deferred_review_queue.csv`: `present`
- `08_excluded_queue.csv`: `present`
- `10_risk_notes.md`: `present`
- `11_open_questions.md`: `present`
- `05_leaf_manifest.json`: `present`
- `06_leaf_manifest.csv`: `present`
- `07_leaf_to_route_mapping.csv`: `present`
- `08_leaf_to_generation_scope.csv`: `present`
- `09_output_shape_matrix.md`: `present`
- `10_test_anchor_matrix.md`: `present`
- `05_canonical_grouping_spec.json`: `present`
- `09_gpt_handoff_units.md`: `present`
- `11_template_to_group_mapping.csv`: `present`
- `12_route_to_group_mapping.csv`: `present`

## Integrated Spec Discovery
- integrated spec found: `True`
- path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/Member_LLM_Integrated_Spec_V1.md`
