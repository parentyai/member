# 01 Scope and Rules

## Purpose

This audit inventories **preset user-facing LLM / FAQ reply templates** only.

Allowed output in this turn:
- add-only audit artifacts under `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT`

Forbidden in this turn:
- editing existing source/runtime/docs/tests
- wording improvement
- refactor / rename / delete / consolidation
- mixing internal prompts into the main inventory

## Search surface actually observed

- `src/`: present
- `apps/`: present
- `config/`: absent
- `data/`: absent
- `fixtures/`: absent
- `seeds/`: absent
- `tests/`: present
- `scripts/`: present
- `tools/`: present
- `docs/`: present

`config/`, `data/`, `fixtures/`, and `seeds/` were part of the requested search surface but do not exist in this detached `origin/main` snapshot.

## Template inclusion rule

A string is included in the main inventory only when **all** of the following hold:
1. it is user-facing text or semi-fixed user-facing text
2. it is preset in repo code/data/policy seed
3. a runtime route, registry, or renderer connection was observed

Included examples:
- FAQ answer scaffolding
- fallback / clarify / refuse copy
- disclaimer / warning
- CTA labels
- button labels
- Flex section labels
- direct command reply texts
- notification/welcome copy when runtime connected

Excluded from the main inventory:
- internal system/developer prompts
- pure test dummies and eval fixtures
- docs-only examples with no runtime connection
- console/internal error labels that do not reach user surfaces

## Runtime truth classes

- `reachable`: route -> selector -> renderer chain observed on current snapshot
- `conditionally_reachable`: route observed, but depends on tier / intent / flag / state / surface plan
- `unconfirmed`: source and potential connection observed, but final end-user delivery on current snapshot was not proven
- `dead_or_test_only`: string exists, but current runtime chain does not deliver it, or it only appears in helper/test/eval paths

## Counting convention

Counts in the summary use **normalized template families** from `03_template_inventory.json`.
A family may contain multiple exact text blocks in `current_text_blocks`.
