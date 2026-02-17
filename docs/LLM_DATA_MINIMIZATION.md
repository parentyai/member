# LLM_DATA_MINIMIZATION

## Principle
- Allow-list only: only explicitly approved fields can be sent to LLM.
- Deny-list is an exception and only for audit validation.
- Raw records must not be passed directly from Firestore documents.

## Data Classes (from DATA_MAP)
- OK (aggregate or state labels): readiness status, counts, health summaries.
- Conditional: hashed identifiers (lineUserId hash), last4, traceId (if required for audit).
- NG: plaintext IDs, secrets, tokens, direct URLs.

## Handling Rules
- Mask or hash identifiers before any LLM payload.
- Drop any field not listed in the allow-list.
- Block when disallowed fields are detected (fail-closed).

## Policy Snapshot (Phase234 add-only)
- `system_flags.phase0.llmPolicy` is the legal-policy snapshot used by LLM usecases.
- Snapshot fields:
  - `lawfulBasis` (`unspecified|consent|contract|legal_obligation|vital_interest|public_task|legitimate_interest`)
  - `consentVerified` (boolean)
  - `crossBorder` (boolean)
- These fields are **not** user profile data; they are operation-policy metadata.
- The snapshot is copied into audit payloadSummary to keep traceable legal context per response.
- Consent gate:
  - `lawfulBasis=consent` and `consentVerified=false` => `consent_missing` BLOCK (fail-closed).

## Allow-list Views

### FAQ
- `question`
- `locale`
- `intent`
- `guideMode` (`faq_navigation|question_refine|checklist_guidance`)
- `personalization.locale`
- `personalization.servicePhase`
- `kbCandidates[].articleId`
- `kbCandidates[].title`
- `kbCandidates[].body`
- `kbCandidates[].tags`
- `kbCandidates[].riskLevel`
- `kbCandidates[].linkRegistryIds`
- `kbCandidates[].status`
- `kbCandidates[].validUntil`
- `kbCandidates[].allowedIntents`
- `kbCandidates[].disclaimerVersion`
- `kbCandidates[].searchScore`

### FAQ Guide-only Guard (Phase235 add-only)
- Allowed `guideMode`:
  - `faq_navigation`
  - `question_refine`
  - `checklist_guidance`
- Block:
  - `guide_only_mode_blocked`（allowed list外 mode）
  - `personalization_not_allowed`（`locale|servicePhase` 以外の personalization キー）

### OpsExplanation
- `readiness.status`
- `readiness.blocking`
- `blockingReasons`
- `riskLevel`
- `notificationHealthSummary.*`
- `allowedNextActions`
- `recommendedNextAction`
- `executionStatus.*`
- `decisionDrift.*`
- `closeDecision`
- `closeReason`
- `phaseResult`
- `lastReactionAt`
- `dangerFlags.*`

### NextActionCandidates
- `readiness.status`
- `readiness.blocking`
- `opsState.nextAction`
- `opsState.failure_class`
- `opsState.reasonCode`
- `opsState.stage`
- `latestDecisionLog.nextAction`
- `latestDecisionLog.createdAt`
- `constraints.allowedNextActions`
- `constraints.readiness`
