# 08 Overlap / Gap Report

## True duplication clusters (observed)

- `T1`: clarify default line duplicated across orchestrator and readiness/finalizer layers
  - `runPaidConversationOrchestrator`
  - `evaluateRequiredCoreFactsGate`
  - `finalizeCandidate`
- `T2`: school `docs_required` direct answer duplicated across
  - `generatePaidDomainConciergeReply`
  - `generatePaidCasualReply`
  - `freeContextualFollowup`
- `T3`: banking `next_step` direct answer duplicated across
  - `generatePaidDomainConciergeReply`
  - `generatePaidCasualReply`
  - `freeContextualFollowup`
- `T4`: domain clarify prompt duplication across orchestrator layers
  - `runPaidConversationOrchestrator`
  - `verifyCandidate`
- `T5`: SSN / appointment-needed and banking next-step copy overlap across paid casual and domain concierge

## Near duplication

- `N1`: refuse templates differ mainly by whether they say "一緒に整理します"
- `N2`: clarify templates differ mainly by "案内を具体化" vs "次の一手を絞る"
- `N3`: recovery direct answer vs normal followup direct answer differ mainly by leading recovery lead-in
- `N4`: generic fallback templates differ mostly by word order

## Route-different same-copy risks

- `R1`: different `strategyReason` / `fallbackType` branches still collapse to the same domain concierge copy pool
- `R2`: `strategyReason` and `routeDecisionSource` are mostly telemetry / audit metadata, not direct copy selectors

## Gaps / ambiguity

- `G1`: `low_specificity_clarify` route exists but uses generic clarify text rather than dedicated low-specificity copy
- `G2`: broad/city fallback slices can become too generic; quality patrol already detects this as broad or city specificity failures
- `A1`: generic fallback is abstract and low-specificity
- `A2`: generic clarify lines often lack route/slice-specific context

## Recommended handling for later GPT handoff

- do **not** merge duplicated families blindly
- split by route and selection conditions first
- then decide whether copy can be unified in a future add-only plan
