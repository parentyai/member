# 01 Input Validation

This file validates the provided fact-freeze hypotheses against the existing audit artifacts and the current audit worktree. It does not re-interpret the inventory.

| Hypothesis | Observed | Status | Evidence |
| --- | --- | --- | --- |
| audit execution context root dirty and HEAD != origin/main | validated from prior audit artifact, not current working tree | MATCH | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/00_start_guard.md |
| normalized template families = 32 | 32 | MATCH | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/03_template_inventory.json |
| exact text blocks = 319 | 319 | MATCH | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/03_template_inventory.json |
| runtime truth counts 15 / 14 / 1 / 2 | 15 / 14 / 1 / 2 | MATCH | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/03_template_inventory.json |
| type counts FAQ 10 fallback 9 warning 4 disclaimer 2 CTA 3 button 2 quick reply 0 | 10 / 9 / 4 / 2 / 3 / 2 / 0 | MATCH | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/10_summary_for_gpt_handoff.md |
| hardcoded vs catalog or seed = 30 : 2 | 30 : 2 | MATCH | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/10_summary_for_gpt_handoff.md |
| policy_override_disclaimer_templates stays unconfirmed | unconfirmed | MATCH | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/03_template_inventory.json |
| search_kb_replytext_templates stays dead_or_test_only | dead_or_test_only | MATCH | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/03_template_inventory.json |
| paid_assistant_legacy_structured_format stays dead_or_test_only | dead_or_test_only | MATCH | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/03_template_inventory.json |
| standalone preset runtime-connected quick reply family | not observed | MATCH | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT/10_summary_for_gpt_handoff.md |
| integrated spec lookup | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/Member_LLM_Integrated_Spec_V1.md | MATCH | /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/Member_LLM_Integrated_Spec_V1.md |

## Must-Preserve Special Classes

- `policy_override_disclaimer_templates` stays `unconfirmed` and is handled as a shadow policy class.
- `search_kb_replytext_templates` stays `dead_or_test_only` and is excluded from live groups.
- `paid_assistant_legacy_structured_format` stays `dead_or_test_only` and is excluded from live groups.
- Standalone preset runtime-connected quick reply family is `not observed`; this is not equivalent to quick reply surface absence.
- Audience leak candidates remain visible and are not normalized away during grouping.

## Notes

- The prior audit status line that showed only `?? docs/LLM_FAQ_TEMPLATE_AUDIT/` belongs to the original audit moment. The current worktree now also contains `docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/` because this spec directory is being reused by explicit user instruction.
- Integrated spec was found and used for crosswalk, but enum values are only structurally aligned, not deterministically convertible.
