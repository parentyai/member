# QUALITY_PATROL_TRANSCRIPT_RUNBOOK

Masked transcript foundation for Member Quality Patrol v1.1 (add-only).

## Scope
- collection: `conversation_review_snapshots`
- write path: `src/routes/webhookLine.js` -> `src/usecases/qualityPatrol/appendConversationReviewSnapshot.js` -> `src/repos/firestore/conversationReviewSnapshotsRepo.js`
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

## Rollback
- immediate stop: set `ENABLE_QUALITY_PATROL_TRANSCRIPT_SNAPSHOTS_V1=0`
- staged rollback: stop runtime writes first, keep existing snapshots read-only
- full rollback: revert the PR that introduced `conversation_review_snapshots`

## Non-goals In PR-0
- no admin read surface
- no patrol query layer
- no raw transcript retention
- no historical backfill from non-durable caches
