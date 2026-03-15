# QUALITY_PATROL_TRANSCRIPT_RUNBOOK

Masked transcript foundation for Member Quality Patrol v1.1 (add-only).

## Scope
- collection: `conversation_review_snapshots`
- write path: `src/routes/webhookLine.js` -> `src/usecases/qualityPatrol/appendConversationReviewSnapshot.js` -> `src/repos/firestore/conversationReviewSnapshotsRepo.js`
- outcome telemetry surface: `src/routes/webhookLine.js` -> `src/repos/firestore/llmActionLogsRepo.js`
- surface: LINE webhook conversation replies only in PR-0

## Stored Data
- keyed identifier: `lineUserKey` (SHA-256 derived, no raw `lineUserId` persisted in this collection)
- trace linkage: `traceId`, `requestId`
- routing metadata: `routeKind`, `domainIntent`, `strategy`, `selectedCandidateKind`, `fallbackTemplateKind`, `replyTemplateFingerprint`, `genericFallbackSlice`
- continuity/grounding metadata: `priorContextUsed`, `followupResolvedFromHistory`, `knowledgeCandidateUsed`, `readinessDecision`
- masked text snapshots:
  - `userMessageMasked`
  - `assistantReplyMasked`
  - `priorContextSummaryMasked`
- masking evidence: `textPolicy`

## Write Outcomes
- transcript snapshot writes remain best-effort and do not block webhook reply flow.
- runtime now classifies snapshot outcomes as:
  - `written`
  - `skipped_flag_disabled`
  - `skipped_missing_line_user_key`
  - `skipped_unreviewable_transcript`
  - `failed_repo_write`
  - `failed_unknown`
- skip/failure reasons are surfaced through add-only `llm_action_logs` metadata so patrol jobs can distinguish write omission from read-side gaps without storing new raw transcript content.
- input diagnostics are also surfaced through add-only `llm_action_logs` metadata:
  - `transcriptSnapshotAssistantReplyPresent`
  - `transcriptSnapshotAssistantReplyLength`
  - `transcriptSnapshotSanitizedReplyLength`
  - `transcriptSnapshotBuildAttempted`
  - `transcriptSnapshotBuildSkippedReason`
- `transcriptSnapshotBuildSkippedReason` is telemetry-only and currently classifies:
  - `feature_flag_off`
  - `line_user_key_missing`
  - `assistant_reply_missing`
  - `sanitized_reply_empty`
  - `masking_removed_text`
  - `region_prompt_fallback`
- this diagnostics surface does not widen transcript retention and does not change runtime reply behavior.

## Masking Rules
- replace emails with `[email]`
- replace URLs with `[url]`
- replace phone-like strings with `[phone]`
- replace postal-code-like strings with `[postal]`
- replace long numeric identifiers with `[number]`
- normalize whitespace and cap stored text length

## Length Caps
- user message: 240 chars
- assistant reply: 420 chars
- prior context summary: 240 chars

## Retention
- policy: `event / 180d / CONDITIONAL / recomputable=true`
- SSOT: `src/domain/retention/retentionPolicy.js`, `docs/SSOT_RETENTION.md`, `docs/REPO_AUDIT_INPUTS/data_lifecycle.json`
- review units consume `conversation_review_snapshots` read-only and do not persist any new transcript copy

## Rollback
- immediate stop: set `ENABLE_QUALITY_PATROL_TRANSCRIPT_SNAPSHOTS_V1=0`
- staged rollback: stop runtime writes first, ignore transcript snapshot outcome telemetry in patrol read-side if needed, keep existing snapshots read-only
- full rollback: revert the PR that introduced `conversation_review_snapshots`

## Non-goals In PR-0
- no admin read surface
- no patrol query layer
- no raw transcript retention
- no historical backfill from non-durable caches
