# 01 Input Validation

## 1. Canonical primary / mirror lock

- primary authority is explicit:
  - `docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/17_artifact_authority_and_drift_guard.md`
  - `docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/18_primary_mirror_lock.json`
- primary file: `05_canonical_grouping_spec.json`
- mirror file: `10_canonical_grouping_spec.json`
- mirror update mode: `regenerate_from_primary_only`
- independent mirror edit: `forbidden`
- observed group count:
  - `05`: `95`
  - `10`: `95`

## 2. Audit -> leaf -> apply -> closure chain

Observed chain is connected as documentation, not as a single runtime module.

1. `docs/LLM_FAQ_TEMPLATE_AUDIT/*`
2. `docs/LLM_FAQ_LEAF_MANIFEST/*`
3. `docs/LLM_FAQ_LEAF_DRAFT_CORPUS/*`
4. `docs/LLM_FAQ_DRAFT_APPLY_GATE/*`
5. `docs/LLM_FAQ_CLOSURE_PACK/*`
6. `docs/LLM_FAQ_CODEX_CLOSURE_EXEC/*`
7. `docs/LLM_FAQ_APPLY_GATE_RERUN/*`
8. `docs/LLM_FAQ_MIN_SAFE_APPLY_EXEC/*`

The chain is observable as file artifacts and cross-references. No gap was found at directory level.

## 3. Safe minimum apply set parity

- registry-safe leaf count observed in runtime:
  - `src/domain/llm/closure/minSafeApplyRegistry.js`
  - count: `12`
- rerun summary safe minimum apply candidate count:
  - `docs/LLM_FAQ_APPLY_GATE_RERUN/09_safe_minimum_apply_set_rerun.json`
  - `summary.safe_minimum_apply_candidates = 12`
- parity conclusion:
  - registry and rerun summary both point to the same safe minimum apply cardinality.

Observed 12-leaf runtime-safe set:

1. `leaf_citypack_feedback_received`
2. `leaf_line_renderer_render_failure`
3. `leaf_paid_finalizer_refuse`
4. `leaf_paid_readiness_clarify_default`
5. `leaf_paid_readiness_hedge_suffix`
6. `leaf_paid_readiness_refuse_default`
7. `leaf_webhook_guard_missing_reply_fallback`
8. `leaf_webhook_readiness_clarify`
9. `leaf_webhook_readiness_refuse`
10. `leaf_webhook_retrieval_failure_fallback`
11. `leaf_webhook_synthetic_ack`
12. `leaf_welcome_message`

## 4. Unresolved class observability

Observed unresolved classes are identifiable from repo facts.

### shell / format not final

- source:
  - `docs/LLM_FAQ_DRAFT_APPLY_GATE/09_apply_readiness_partition.csv`
- observed `shell_only_not_for_apply = 7`
- observed shell set:
  - `leaf_citypack_feedback_usage`
  - `leaf_free_style_checklist`
  - `leaf_free_style_coach`
  - `leaf_free_style_quick`
  - `leaf_free_style_timeline`
  - `leaf_free_style_weekend`
  - `leaf_paid_conversation_format_shell`

### binding pending

- source:
  - `docs/LLM_FAQ_DRAFT_APPLY_GATE/09_apply_readiness_partition.csv`
  - `docs/LLM_FAQ_CLOSURE_PACK/09_human_policy_freeze_pack.json`
- `ready_after_binding_contract = 1`
  - `leaf_paid_reply_guard_defaults`
- multiple blocked apply leaves remain because binding source or contract anchor is incomplete.

### human / policy freeze pending

- source:
  - `docs/LLM_FAQ_CLOSURE_PACK/09_human_policy_freeze_pack.json`
- observed freeze record count: `8`
- observed freeze examples:
  - `leaf_line_renderer_deeplink_with_url`
  - `leaf_webhook_direct_command_ack`
  - `leaf_task_flex_labels`
  - `leaf_task_flex_buttons`
  - `leaf_citypack_feedback_usage`

### shadow / excluded classes

- source:
  - `docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/05_canonical_grouping_spec.json`
- observed:
  - `unconfirmed`: `policy_override_disclaimer_templates`
  - `dead_or_test_only`: `search_kb_replytext_templates`, `paid_assistant_legacy_structured_format`
  - explicit exclusions are listed.

## 5. Integrated spec readability

Integrated spec is sufficient to read the following without the workbook:

- `tasks` as first-class response fields
- `service_surface` and `handoff_state`
- `Task Planner`, `LINE Interaction Policy`, `LINE Channel Renderer`
- `rich_menu`, `LIFF`, `MINI App` role split
- task fields: `task_id`, `title`, `status`, `priority`, `due_at`, `required_docs`, `blockers`

## 6. Workbook validation result

- target workbook file was not observed in repo root
- repo root `.xlsx` search returned no results
- cross-volume exact-name search did not produce an observed result during this planning run
- consequence:
  - sheet-level claims for `00_Canvas`, `01_AtomicSteps`, `03_StateMachine`, `13_RM_Canvas`, `19_RM_ActionMap`, `20_RM_Runbook` cannot be asserted from direct workbook evidence
  - plan must mark workbook-derived sections as provisional until the workbook is supplied

## Validation conclusion

- planning can proceed
- workbook-dependent decisions must stay marked `provisional`
- phase1 implementation should not assume workbook-only semantics that are not already backed by integrated spec, route code, or Firestore SSOT docs

