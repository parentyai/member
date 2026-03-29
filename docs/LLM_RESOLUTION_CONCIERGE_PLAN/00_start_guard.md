# 00 Start Guard

## Scope

- mode: `PLAN ONLY`
- implementation change: `forbidden`
- existing docs modification: `forbidden`
- allowed output: `docs/LLM_RESOLUTION_CONCIERGE_PLAN/*` add-only only
- target repo root: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001`

## Git evidence

```bash
git -C "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001" branch --show-current
# codex/llm-closure-pack-bind-variant-test

git -C "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001" rev-parse HEAD
# 834eaf010876a6c08d21efd38a0e135df7987cb4

git -C "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001" rev-parse --short HEAD
# 834eaf01

git -C "/Volumes/Arumamihs/Member-llm-faq-template-audit-T001" status -sb
# ## codex/llm-closure-pack-bind-variant-test
#  M src/domain/cityPackFeedbackMessages.js
#  M src/domain/llm/orchestrator/finalizeCandidate.js
#  M src/domain/llm/quality/applyAnswerReadinessDecision.js
#  M src/routes/webhookLine.js
#  M src/usecases/notifications/sendWelcomeMessage.js
#  M src/v1/line_renderer/lineChannelRenderer.js
# ?? docs/LLM_FAQ_APPLY_GATE_RERUN/
# ?? docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/
# ?? docs/LLM_FAQ_CLOSURE_PACK/
# ?? docs/LLM_FAQ_CODEX_CLOSURE_EXEC/
# ?? docs/LLM_FAQ_DRAFT_APPLY_GATE/
# ?? docs/LLM_FAQ_LEAF_DRAFT_CORPUS/
# ?? docs/LLM_FAQ_LEAF_MANIFEST/
# ?? docs/LLM_FAQ_MIN_SAFE_APPLY_EXEC/
# ?? docs/LLM_FAQ_MIN_SAFE_BRIDGE_EXEC/
# ?? docs/LLM_FAQ_TEMPLATE_AUDIT/
# ?? src/domain/llm/closure/
# ?? tests/phase860/
# ?? tests/phase861/
# ?? tests/phase862/
```

## Required input existence

| Input | Status | Evidence |
| --- | --- | --- |
| canonical primary `05_canonical_grouping_spec.json` | exists | `docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/05_canonical_grouping_spec.json` |
| canonical mirror `10_canonical_grouping_spec.json` | exists | `docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/10_canonical_grouping_spec.json` |
| drift guard `17_artifact_authority_and_drift_guard.md` | exists | `docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/17_artifact_authority_and_drift_guard.md` |
| primary mirror lock `18_primary_mirror_lock.json` | exists | `docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/18_primary_mirror_lock.json` |
| audit chain root | exists | `docs/LLM_FAQ_TEMPLATE_AUDIT` |
| leaf manifest root | exists | `docs/LLM_FAQ_LEAF_MANIFEST` |
| leaf draft corpus root | exists | `docs/LLM_FAQ_LEAF_DRAFT_CORPUS` |
| apply gate root | exists | `docs/LLM_FAQ_DRAFT_APPLY_GATE` |
| closure pack root | exists | `docs/LLM_FAQ_CLOSURE_PACK` |
| codex closure exec root | exists | `docs/LLM_FAQ_CODEX_CLOSURE_EXEC` |
| apply gate rerun root | exists | `docs/LLM_FAQ_APPLY_GATE_RERUN` |
| min safe apply exec root | exists | `docs/LLM_FAQ_MIN_SAFE_APPLY_EXEC` |
| integrated spec | exists | `Member_LLM_Integrated_Spec_V1.md` |
| workbook `米国赴任AtoZ_ジャーニー仕様書_canvas_v3_citypack_vendor_richmenu.xlsx` | missing | repo root search returned no `.xlsx`; name search under `/Volumes/Arumamihs` produced no observed hit during planning window |
| runtime touchpoint `applyAnswerReadinessDecision.js` | exists | `src/domain/llm/quality/applyAnswerReadinessDecision.js` |
| runtime touchpoint `finalizeCandidate.js` | exists | `src/domain/llm/orchestrator/finalizeCandidate.js` |
| runtime touchpoint `webhookLine.js` | exists | `src/routes/webhookLine.js` |
| runtime touchpoint `lineChannelRenderer.js` | exists | `src/v1/line_renderer/lineChannelRenderer.js` |
| runtime touchpoint `sendWelcomeMessage.js` | exists | `src/usecases/notifications/sendWelcomeMessage.js` |
| runtime touchpoint `cityPackFeedbackMessages.js` | exists | `src/domain/cityPackFeedbackMessages.js` |
| runtime touchpoint `minSafeApplyRegistry.js` | exists | `src/domain/llm/closure/minSafeApplyRegistry.js` |
| runtime touchpoint `codexOnlyClosureContracts.js` | exists | `src/domain/llm/closure/codexOnlyClosureContracts.js` |

## Artifact chain counts

| Directory | File count |
| --- | ---: |
| `docs/LLM_FAQ_TEMPLATE_AUDIT` | 11 |
| `docs/LLM_FAQ_LEAF_MANIFEST` | 16 |
| `docs/LLM_FAQ_LEAF_DRAFT_CORPUS` | 13 |
| `docs/LLM_FAQ_DRAFT_APPLY_GATE` | 17 |
| `docs/LLM_FAQ_CLOSURE_PACK` | 17 |
| `docs/LLM_FAQ_CODEX_CLOSURE_EXEC` | 11 |
| `docs/LLM_FAQ_APPLY_GATE_RERUN` | 16 |
| `docs/LLM_FAQ_MIN_SAFE_APPLY_EXEC` | 8 |

## Planning assumptions locked at start

1. workbook-driven journey / rich menu sheet observation is unavailable because the workbook itself was not observed.
2. plan artifacts must stay add-only because the target repo already has dirty tracked runtime files and new untracked audit trees.
3. route and artifact facts are taken from the current dirty repo state because the required closure artifacts are not yet part of the observed HEAD commit.

## Initial failure taxonomy hypotheses to test

- `under_informative_answer`
- `missing_official_link`
- `answer_without_next_action`
- `no_task_externalization`
- `todo_invisibility`
- `over_clarification`
- `fallback_overuse`
- `disclaimer_frontloading`
- `route_style_fragmentation`
- `renderer_flatness`
- `helpfulness_without_resolution`
- `rich_menu_detached_from_conversation`

