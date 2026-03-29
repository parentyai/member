# Risk Register

## 1. Passing Tests Mistaken As Apply-Ready

- wrong judgment:
  - tests passed, so the leaf is ready to apply
- why wrong:
  - tests can close anchor gaps without resolving policy or shell blockers
- detection:
  - compare rerun partition against blocked reasons
- prevention in this rerun:
  - readiness and test success are recorded separately

## 2. Variant Freeze Without Policy Freeze

- wrong judgment:
  - keyed leaves are ready because canonical keys now exist
- why wrong:
  - some keyed leaves still depend on policy choices outside codex-only scope
- detection:
  - leaf remains in `blocked_apply` with `policy_freeze_pending`
- prevention in this rerun:
  - `leaf_task_flex_labels`, `leaf_task_flex_buttons`, and `leaf_webhook_direct_command_ack` remain blocked

## 3. Binding Closure Without Literal Final Text

- wrong judgment:
  - a frozen binding source means the leaf is now literal-ready
- why wrong:
  - parameterized leaves may still require runtime substitution
- detection:
  - current partition is `ready_after_binding_contract`, not `ready_literal_now`
- prevention in this rerun:
  - `leaf_free_retrieval_empty_reply` is promoted only to `ready_after_binding_contract`

## 4. Shell Leaf Wrongly Promoted

- wrong judgment:
  - style or shell text can be promoted after rerun because nothing else changed
- why wrong:
  - ellipsis and semantic shells still lack final wording
- detection:
  - shell bucket remains unchanged
- prevention in this rerun:
  - all 7 shell leaves stay `shell_only_not_for_apply`

## 5. Format Placeholder Treated As Final Copy

- wrong judgment:
  - `-` or `label: url` can ship as user-facing copy
- why wrong:
  - those strings are format placeholders, not resolved user text
- detection:
  - current blocked reason is `format_placeholder_still_present`
- prevention in this rerun:
  - notification defaults remain blocked

## 6. No Before / After Diff

- wrong judgment:
  - closure execution obviously improved readiness, so no explicit diff is needed
- why wrong:
  - the rerun can overstate progress without concrete per-leaf comparison
- detection:
  - absence of per-leaf prior/current partition table
- prevention in this rerun:
  - `06_before_after_diff.md` and `07_before_after_diff.csv` fix the delta explicitly

## 7. Confusing Ready After Binding With Ready Literal Now

- wrong judgment:
  - both are equally safe to apply as literals
- why wrong:
  - `ready_after_binding_contract` still depends on runtime substitution
- detection:
  - promoted class remains parameterized, not literal
- prevention in this rerun:
  - safe minimum apply set excludes `leaf_free_retrieval_empty_reply`
