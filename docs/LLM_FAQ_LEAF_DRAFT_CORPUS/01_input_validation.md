# 01 Input Validation

| Check | Result | Notes |
| --- | --- | --- |
| 05_leaf_manifest.json parse | pass | parsed successfully |
| leaf count | pass | 80 |
| summary counts | pass | generate=71, isolate=5, exclude_shadow=3, unknown=1 |
| 08_leaf_to_generation_scope.csv | pass | generation flags readable |
| 09_output_shape_matrix.md | pass | shape contract readable |
| 10_test_anchor_matrix.md | pass | human review gate readable |
| must_not_merge_with self-reference | pass | none observed |
| shadow / isolate / unknown separation | pass | preserved |
| integrated spec discovery | pass | Member_LLM_Integrated_Spec_V1.md found |

## Fact freeze preserved
- total leafs: `80`
- generate: `71`
- isolate_for_human_or_separate_policy: `5`
- exclude_shadow: `3`
- unknown: `1`
- SAFE_ONLY eligible set after filters: `35`
