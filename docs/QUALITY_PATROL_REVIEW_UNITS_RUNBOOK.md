# Quality Patrol Review Units Runbook

## Scope
- PR-2 introduces a read-only extractor for Quality Patrol review units.
- review units are derived from existing sources and are not persisted.
- sources: `conversation_review_snapshots`, `llm_action_logs`, `faq_answer_logs`, `trace_bundle`

## Output contract
- extractor usecase: `src/usecases/qualityPatrol/buildConversationReviewUnitsFromSources.js`
- domain builder: `src/domain/qualityPatrol/transcript/buildConversationReviewUnits.js`
- review units normalize masked transcript fields, telemetry signals, slice classification, and observation blockers.
- review unit anchors are created from `conversation_review_snapshots` or `llm_action_logs`; `faq_answer_logs` are supplemental evidence only.
- extractor backfills missing snapshot rows per selected trace so duplicate snapshot writes do not crowd later traces out of the default patrol window.
- extractor hydrates `faq_answer_logs` from trace-joined evidence for the selected anchors, so unrelated latest FAQ rows do not inflate current patrol debt.
- extractor surfaces add-only join diagnostics: `faqOnlyRowsSkipped`, `traceHydrationLimitedCount`, `reviewUnitAnchorKindCounts`.
- PR-3 evaluator reads review units via `src/usecases/qualityPatrol/evaluateConversationReviewUnits.js` and does not persist a second transcript artifact.

## Slice classification
- deterministic priority:
  1. `genericFallbackSlice`
  2. `priorContextUsed` / `followupResolvedFromHistory`
  3. city signals (`cityPackCandidateAvailable`, `cityPackUsedInAnswer`, `knowledgeGroundingKind`)
  4. housing signals
  5. broad strategy signals
  6. `other`
- review unit slice values: `broad`, `housing`, `city`, `follow-up`, `other`

## Observation blockers
- extractor does not fail the whole batch when evidence is missing.
- `missing_trace_evidence` is reserved for real source/join absence; trace fetch limits are surfaced via join diagnostics instead of inflating blockers.
- default patrol callers now let `traceLimit` follow `limit` up to 200, which prevents the default read-only window from manufacturing trace-hydration debt when the window itself fits inside the fetch budget.
- blocker codes:
  - `missing_user_message`
  - `missing_assistant_reply`
  - `missing_prior_context_summary`
  - `missing_trace_evidence`
  - `missing_action_log_evidence`
  - `missing_faq_evidence`
  - `transcript_not_reviewable`
- these are raw review-unit blocker codes. PR-C keeps them for internal evaluation/root-cause inputs, then query-facing serializers regroup them into more precise operator/human blocker rows such as:
  - `transcript_write_coverage_missing`
  - `action_trace_join_limited`
  - `action_log_source_missing`
  - `trace_source_missing`
  - `insufficient_runtime_evidence`
  - `observation_gap`

## Privacy and retention
- extractor consumes masked transcript snapshots only.
- raw transcript is not persisted by PR-2.
- FAQ rows without a matching snapshot/action anchor are skipped from review-unit creation rather than promoted into standalone transcript evidence.
- review units are in-memory outputs and inherit source retention from existing collections.

## Rollback
- stop calling `buildConversationReviewUnitsFromSources`.
- revert the PR if the extractor contract needs to be removed.
