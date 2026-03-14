# Quality Patrol Review Units Runbook

## Scope
- PR-2 introduces a read-only extractor for Quality Patrol review units.
- review units are derived from existing sources and are not persisted.
- sources: `conversation_review_snapshots`, `llm_action_logs`, `faq_answer_logs`, `trace_bundle`

## Output contract
- extractor usecase: `src/usecases/qualityPatrol/buildConversationReviewUnitsFromSources.js`
- domain builder: `src/domain/qualityPatrol/transcript/buildConversationReviewUnits.js`
- review units normalize masked transcript fields, telemetry signals, slice classification, and observation blockers.

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
- blocker codes:
  - `missing_user_message`
  - `missing_assistant_reply`
  - `missing_prior_context_summary`
  - `missing_trace_evidence`
  - `missing_action_log_evidence`
  - `missing_faq_evidence`
  - `transcript_not_reviewable`

## Privacy and retention
- extractor consumes masked transcript snapshots only.
- raw transcript is not persisted by PR-2.
- review units are in-memory outputs and inherit source retention from existing collections.

## Rollback
- stop calling `buildConversationReviewUnitsFromSources`.
- revert the PR if the extractor contract needs to be removed.
