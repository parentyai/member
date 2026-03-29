# Safe Minimum Apply Set (Rerun)

## Count

- `ready_literal_now` pool after rerun: `16`
- conservative safe minimum apply set: `12`

## Safe Minimum Candidates

The following leaves are the smallest low-coupling set that can move next without mixing in shell, policy-freeze, or assembly-heavy renderer coupling:

- `leaf_citypack_feedback_received`
- `leaf_line_renderer_render_failure`
- `leaf_paid_finalizer_refuse`
- `leaf_paid_readiness_clarify_default`
- `leaf_paid_readiness_hedge_suffix`
- `leaf_paid_readiness_refuse_default`
- `leaf_webhook_guard_missing_reply_fallback`
- `leaf_webhook_readiness_clarify`
- `leaf_webhook_readiness_refuse`
- `leaf_webhook_retrieval_failure_fallback`
- `leaf_webhook_synthetic_ack`
- `leaf_welcome_message`

## Why Not All 16

The following `ready_literal_now` leaves are intentionally excluded from the minimum set because they are more coupled to composite assembly or renderer composition:

- `leaf_paid_finalizer_fallback`
- `leaf_webhook_low_relevance_clarify`
- `leaf_line_renderer_overflow_summary`
- `leaf_line_renderer_deeplink_generic`

## Required Apply Discipline

Even for the 12-leaf minimum set:

- apply should remain add-only
- no wording edits should be made during apply
- each leaf should be mapped one-to-one from current anchored literal to its eventual registry slot
- no leaf in the minimum set should be batch-merged with non-ready leaves
