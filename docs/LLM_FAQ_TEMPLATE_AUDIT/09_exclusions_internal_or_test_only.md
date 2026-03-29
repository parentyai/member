# 09 Exclusions / Internal / Test Only

## Internal prompts (excluded from main inventory)

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/faq/answerFaqFromKb.js:35`
  - `SYSTEM_PROMPT`
  - reason: model-facing system prompt, not user-facing template
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/assistant/generatePaidAssistantReply.js:674`
  - `buildPrompt().system`
  - reason: internal system prompt

## Pure test / eval fixtures (excluded from main inventory)

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase733/phase733_t01_paid_golden_eval_contract.test.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase849/phase849_t02_missing_false_blocked_unavailable_contract.test.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tools/llm_eval/paid_golden_set.json`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tools/llm_quality/fixtures/human_adjudication_set.v1.json`

## Docs-only or docs-adjacent examples not promoted into runtime truth

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_RUNBOOK.md` examples remain docs-only unless a code route/renderer path was observed
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_TEST_PLAN.md` references test plans and missing legacy paths; not promoted into main runtime inventory

## Dead/test-only user-facing strings kept out of the live-reachable summary

These strings remain in `03_template_inventory.json` with `runtime_truth=dead_or_test_only`, but they are excluded from the live-reachable subset:
- `search_kb_replytext_templates`
- `paid_assistant_legacy_structured_format`
