# 00 Start Guard

## Repo Guard

```bash
git -C /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 branch --show-current

git -C /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 rev-parse HEAD
834eaf010876a6c08d21efd38a0e135df7987cb4

git -C /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 rev-parse --short HEAD
834eaf01

git -C /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 status -sb
## HEAD (no branch)
?? docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/
?? docs/LLM_FAQ_TEMPLATE_AUDIT/
```

## Input Presence

- repo_root: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001
- audit_dir: present (/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT)

### required audit files
- present: 00_start_guard.md
- present: 01_scope_and_rules.md
- present: 02_template_source_index.md
- present: 03_template_inventory.json
- present: 04_template_inventory_human_readable.md
- present: 05_selection_paths.md
- present: 06_dependency_graph.mmd
- present: 07_runtime_truth_report.md
- present: 08_overlap_gap_report.md
- present: 09_exclusions_internal_or_test_only.md
- present: 10_summary_for_gpt_handoff.md

### integrated spec input
- present: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/Member_LLM_Integrated_Spec_V1.md
