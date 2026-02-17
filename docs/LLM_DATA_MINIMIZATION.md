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

## Allow-list Views

### FAQ
- `question`
- `locale`
- `intent`
- `kbCandidates[].articleId`
- `kbCandidates[].title`
- `kbCandidates[].body`
- `kbCandidates[].tags`
- `kbCandidates[].riskLevel`
- `kbCandidates[].linkRegistryIds`

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
