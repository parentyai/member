# UX_OS_PLAN2_HARDENED_V1

## Purpose
- Freeze a safe, foundation-only execution plan for UX OS P0.
- Eliminate dependence on external draft files and stale commit references.
- Enforce add-only, rollback-first, multi-PR delivery.

## Source And Snapshot
- Input draft source: `/Users/parentyai.com/Downloads/PLAN2.md`
- This document is the repo-tracked source of truth for execution.
- Runtime snapshot must always be re-validated from:
  - `git branch --show-current`
  - `git rev-parse HEAD`
  - `git status -sb`

## P0 Scope Freeze
P0 is restricted to foundation-only. The following are in-scope:

1. Docs hardening and contract freeze.
2. Feature flags for UX OS foundation surfaces.
3. Sidecar UX events (`notification_sent`, `reaction_received`) as append-only and best-effort.
4. Canonical next best action adapter using Task Engine authority only.
5. Read-only admin route and read-only policy pane.
6. Fatigue warning computation and display only (no send blocking).
7. Regression/evidence/rollback hardening.

Out of scope for P0:
- Member-facing progress visualization.
- City Pack suggestion/ranking enhancement.
- Paid continuity UX.
- Emergency override UX.
- Any write-capable policy console editor.

## Authority Contract
- Canonical authority for action selection remains `computeNextTasks`.
- `phaseLLM3/getNextActionCandidates` remains advisory-only and cannot become canonical.
- `ux_events` is not a state source of truth and cannot replace:
  - `events`
  - `notification_deliveries`
  - `audit_logs`
  - `llm_usage_logs`

## Touch List (P0)
- `docs/UX_OS_PLAN2_HARDENED_V1.md`
- `docs/INDEX_PLAN.md`
- `docs/SSOT_UX_OS_FOUNDATION_V1.md`
- `docs/RUNBOOK_UX_OS_FOUNDATION_V1.md`
- `docs/SSOT_ADMIN_UI_OS.md`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `docs/SSOT_TASK_ENGINE_V1.md`
- `src/index.js`
- `src/domain/tasks/featureFlags.js`
- `src/repos/firestore/uxEventsRepo.js`
- `src/usecases/observability/appendUxEvent.js`
- `src/usecases/notifications/sendNotification.js`
- `src/usecases/phase37/markDeliveryReactionV2.js`
- `src/usecases/tasks/getNextBestAction.js`
- `src/routes/admin/nextBestAction.js`
- `src/usecases/notifications/computeNotificationFatigueWarning.js`
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `tests/**` (targeted only)
- `docs/EVIDENCE_UX_OS_FOUNDATION_V1.md`

## Non-Touch List (P0)
- `src/routes/webhookLine.js`
- `src/usecases/assistant/*`
- `src/usecases/emergency/*`
- `src/routes/admin/emergencyLayer.js`
- `src/usecases/cityPack/*`
- `src/usecases/journey/handleJourneyLineCommand.js`
- `src/usecases/journey/applyRichMenuAssignment.js`
- Existing `/plan` and `/set` admin route semantics.
- Rich menu behavior changes.

## PR Breakdown
1. PR0: hardening docs only.
2. PR1: foundation contract and flags.
3. PR2: `ux_events` sidecar foundation.
4. PR3: canonical NBA adapter and read-only admin route.
5. PR4: fatigue warn-only and read-only policy pane.
6. PR5: regression/evidence/merge hardening.

## Kill-Switch Matrix
| flag | purpose | owner PR | rollback behavior |
| --- | --- | --- | --- |
| `ENABLE_UXOS_EVENTS_V1` | sidecar ux events append | PR1/PR2 | disable event append only |
| `ENABLE_UXOS_NBA_V1` | canonical NBA adapter and route | PR1/PR3 | disable route/adapter surface |
| `ENABLE_UXOS_FATIGUE_WARN_V1` | fatigue warning compute/display | PR1/PR4 | disable warnings only |
| `ENABLE_UXOS_POLICY_READONLY_V1` | policy pane/read model surface | PR1/PR4 | hide pane and route fields |

## Test Matrix
| PR | required tests |
| --- | --- |
| PR0 | `npm run test:docs` |
| PR1 | `npm run test:docs`, flag helper unit |
| PR2 | uxEvents repo contract, idempotency, PII non-storage, send/reaction regressions |
| PR3 | adapter unit, read-only route contract, trace/audit, no-state-mutation |
| PR4 | `npm run test:docs`, `npm run test:admin-nav-contract`, pane/read-only/no-block tests |
| PR5 | docs/nav gates, targeted regression (`phase653,658,663,669,700,717,719,720,731,733`) |

## Rollback Matrix
| PR | immediate stop | full rollback |
| --- | --- | --- |
| PR0 | not required (docs only) | revert docs commit |
| PR1 | flags default off-safe | revert PR1 commit |
| PR2 | `ENABLE_UXOS_EVENTS_V1=0` | revert PR2 commit |
| PR3 | `ENABLE_UXOS_NBA_V1=0` | revert PR3 commit |
| PR4 | `ENABLE_UXOS_FATIGUE_WARN_V1=0`, `ENABLE_UXOS_POLICY_READONLY_V1=0` | revert PR4 commit |
| PR5 | not required (tests/docs only) | revert PR5 commit |

## HOLD Conditions
- Adapter cannot remain strictly downstream of `computeNextTasks`.
- Read-only admin route cannot satisfy `x-actor + trace + audit`.
- Sidecar `ux_events` cannot be bounded/idempotent.
- Fatigue implementation requires send blocking.
- P0 requires touching any non-touch path.

## NO-GO Conditions
- Existing API/webhook/Firestore semantics must be changed.
- Existing event/delivery/audit/log contracts must be redefined.
- P1/P2 features are required for P0 correctness.
- Flag-off cannot stop behavior safely.
