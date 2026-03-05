# SSOT LLM Concierge Opportunity Engine V1

## Purpose

Paid concierge responses use two modes:

- `casual`: natural short conversation, no retrieval checklist, no URLs
- `concierge`: intervention reply with at most one intervention per turn

Safety core contracts remain unchanged:

- kill-switch (`getPublicWriteSafetySnapshot`)
- policy / URL ranking / injection defense
- audit (`llm_gate.decision`)

## Scope

This SSOT applies only to the paid path in `src/routes/webhookLine.js`.

Free path (`plan !== pro`) keeps retrieval-first behavior.

## Opportunity Input Contract

```json
{
  "lineUserId": "string",
  "userTier": "paid|free",
  "messageText": "string",
  "journeyPhase": "string",
  "topTasks": [{"key":"string","status":"open|locked|done","due":"ISO|null"}],
  "blockedTask": {"key":"string","status":"locked","due":"ISO|null"},
  "dueSoonTask": {"key":"string","status":"open","due":"ISO|null"},
  "riskFlags": ["string"],
  "recentEngagement": {
    "recentTurns": 5,
    "recentInterventions": 0,
    "recentClicks": false,
    "recentTaskDone": false
  },
  "safetySnapshot": {"killSwitchOn": false}
}
```

## Opportunity Output Contract

```json
{
  "conversationMode": "casual|concierge",
  "opportunityType": "none|action|blocked|life",
  "opportunityReasonKeys": ["string"],
  "interventionBudget": 0,
  "suggestedAtoms": {
    "nextActions": ["string"],
    "pitfall": "string|null",
    "question": "string|null"
  }
}
```

## Rules

1. Greeting and smalltalk always map to `casual` (`interventionBudget=0`).
2. `opportunityType` is set only when `action|blocked|life` signals are present.
3. Cooldown gate: if recent interventions exist in the configured window, force `interventionBudget=0`.
4. One-turn budget: at most one intervention per turn.
5. `suggestedAtoms.nextActions` must be capped at 3.
6. If `llmConciergeEnabled=false`, force `casual`.
7. `ENABLE_PAID_OPPORTUNITY_ENGINE_V1` default is `false` and must be enabled intentionally for rollout.
8. If `ENABLE_PAID_OPPORTUNITY_ENGINE_V1=false`, paid path reverts to existing flow.

## Casual Mode Contract

- Must not call paid retrieval generation in greeting/smalltalk turns.
- Must not emit URL footers.
- Must keep message short and include at most one prompt question.

## Concierge Mode Contract

- Use existing concierge compose pipeline.
- Keep evidence URL behavior under existing mode policy (`A/B/C`) and URL ranker contracts.
- Keep injection guard and post-render lint contracts unchanged.

## Audit Contract Addendum

`llm_gate.decision.payloadSummary` may include the following add-only keys:

- `conversationMode`
- `opportunityType`
- `opportunityReasonKeys`
- `interventionBudget`

`llm_action_logs` may include the same add-only keys for intervention traceability.

## Rollback

Immediate disable:

- set `ENABLE_PAID_OPPORTUNITY_ENGINE_V1=false`

Full rollback:

- revert the implementing PR
