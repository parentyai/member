# SSOT Phase21

## Phase
- Phase: 21
- Status: PREPARE

## Purpose
Phase21 is the minimal implementation phase to sustain ongoing CTA A/B operation with measurable, auditable facts (counts and logs), without adding new decision logic.

## Scope (What Phase21 is / is not)

### In Scope
- Maintainable CTA A/B operation for `openA` / `openB` based on existing tracking + stats flow
- Fact-based measurement continuity (e.g., `sentCount`, `clickCount`, `scannedDocs`, requestId correlation)
- Guarding existing behavior (no breaking changes)

### Out of Scope
- New product features or UX redesign
- Any new decision/optimization logic (ranking, recommendations, auto-routing)
- Authentication model changes (Cloud Run IAM, IAP, proxy, etc.)
- Re-interpretation or re-execution of Phase20 decisions as “design work”

## Phase20 Hand-off (Facts Only)

### What is possible (facts)
- `member-track` unauth `POST /track/click` returns HTTP 302 with `Location`.
- `phase18_cta_stats` has `clickCount > 0` observed via the existing stats script.
- Stats aggregation is stable with `filterField=createdAt`.

### What is not covered by Phase20 (not a defect)
- Continuous operation guarantees beyond the observed facts window.
- Any interpretation of A/B results (winner/loser).

## Success Criteria (All must be YES to close Phase21)
- `sentCount` and `clickCount` can be produced as facts for both `openA` and `openB` over a specified UTC window.
- The measurement pipeline remains reproducible (same inputs -> same script -> counts).
- Rollback is possible via reverting the specific PR that introduced a change.

