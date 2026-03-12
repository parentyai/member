# LLM Quality Loop v2

## Purpose
- Extend the existing quality v1 foundation into an integration-aware loop:
  - `Audit -> Score -> Diagnose -> Plan PRs -> Implement -> Test -> Deploy -> Telemetry -> Re-Audit`
- Keep the current response/runtime contracts intact while adding cross-system quality controls for:
  - City Pack / Local Guidance / Source Refs
  - Emergency Layer
  - Journey / Task / blocker grounding
  - saved FAQ / KB reuse
  - cross-system trace join and operator UX

## Start Guard
- Work must start from a clean branch created from `origin/main`.
- Dirty unrelated diffs are blocked and must be isolated before PR creation.
- Existing operator flow remains read-only and one-click trace open must stay intact.

## Critical Slices
The following slices are release blockers even if global quality remains `pass`.

- `emergency_high_risk`
- `saved_faq_high_risk_reuse`
- `journey_blocker_conflict`
- `stale_city_pack_required_source`
- `compat_spike`
- `trace_join_incomplete`
- `direct_url_leakage`
- `official_source_missing_on_high_risk`

## Cross-System Priority Order
1. Emergency
2. Legal / Consent
3. Task Blocker
4. Journey State
5. City Pack / Source Refs / Local Guidance
6. Saved FAQ
7. Generic LLM reasoning

## Runtime Quality Layer v2
- Core decision remains `allow | hedged | clarify | refuse`.
- New add-only context inputs:
  - `emergencyContext`
  - `emergencySeverity`
  - `emergencyOfficialSourceSatisfied`
  - `journeyContext`
  - `journeyPhase`
  - `taskBlockerContext`
  - `taskBlockerDetected`
  - `journeyAlignedAction`
  - `cityPackFreshnessScore`
  - `cityPackAuthorityScore`
  - `savedFaqValid`
  - `savedFaqAllowedIntent`
  - `savedFaqAuthorityScore`
  - `crossSystemConflictDetected`

## Integration KPI
| KPI | No-Go |
| --- | --- |
| `cityPackGroundingRate` | `< 0.90` |
| `staleSourceBlockRate` | `< 0.95` on high-risk |
| `emergencyOfficialSourceRate` | `< 1.00` |
| `emergencyOverrideAppliedRate` | observation required, sudden increase requires review |
| `journeyAlignedActionRate` | `< 0.85` |
| `taskBlockerConflictRate` | `> 0.02` |
| `savedFaqReusePassRate` | `< 0.90` |
| `crossSystemConflictRate` | missing = fail, sudden increase requires review |
| `traceJoinCompleteness` | `< 0.90` |
| `adminTraceResolutionTime` | `stg p50 > 15m`, `prod p50 > 30m` |

## Rollout Stages
1. `design_only`
2. `log_only`
3. `soft_enforcement`
4. `hard_enforcement`
5. `nogo_gate_mandatory`
6. `continuous_improvement_loop_active`

## Replay / Golden Coverage
- `city-pack-informed answer`
- `emergency influenced answer`
- `blocker-aware next action`
- `saved FAQ reuse decline`
- `contradictory source conflict`
- `quote/unsend/redelivery continuity`
- `group privacy genericization`

## Reservation
- `judge_disagreement_queue`
- `integration_counterexample_registry`
- `replay_slice_registry`
- `saved_faq_retirement_review`
- `emergency_override_review_queue`
- `city_pack_freshness_recertification_report`
