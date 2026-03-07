# SSOT_UX_OS_FOUNDATION_V1

UX OS foundation-only (P0) contract for Member.

## Goals
- Establish observability and operator visibility without changing existing authority boundaries.
- Keep implementation add-only and independently rollbackable by feature flags.

## Non-Goals
- No member-facing progress UI.
- No City Pack ranking enhancement.
- No paid continuity orchestration changes.
- No emergency override UX changes.
- No write-capable policy console.

## Authority Contract
- Canonical authority remains `src/usecases/tasks/computeNextTasks.js`.
- `getNextBestAction` is an adapter over existing deterministic task outputs.
- `src/usecases/phaseLLM3/getNextActionCandidates.js` remains advisory for ops use.
- LLM does not get state transition authority.

## Data Boundary Contract
- Existing data contracts remain unchanged:
  - `events`
  - `notification_deliveries`
  - `audit_logs`
  - `llm_usage_logs`
- New `ux_events` is a sidecar read-model aid only.
- `ux_events` is append-only and best-effort; failure must not break send/reaction flows.

## UX Events Contract (P0 Only)
- Collection: `ux_events`
- Allowed types (P0):
  - `notification_sent`
  - `reaction_received`
- Idempotent doc IDs:
  - `notification_sent__{deliveryId}`
  - `reaction_received__{deliveryId}__{action}`
- Required fields:
  - `eventId`, `lineUserId`, `type`, `deliveryId`, `occurredAt`, `traceId`, `requestId`, `actor`, `source`
- Optional fields:
  - `notificationId`, `action`, `todoKey`, `metadata`
- Forbidden fields:
  - raw user message content (`responseText`)
  - free-form PII payloads
- Retention:
  - 35 days from `occurredAt` (stored as `expiresAt` for TTL policy compatibility)

## Read-Only And Audit Contract
- Any admin read route introduced by UX OS foundation must enforce:
  - `x-actor` required
  - `traceId` via `resolveTraceId`
  - append audit entry (`appendAuditLog`)
- Read-only means:
  - GET-only endpoint
  - no state mutation on Firestore write paths
- Foundation read routes:
  - `GET /api/admin/os/next-best-action?lineUserId=...`
  - `GET /api/admin/os/notification-fatigue-warning?lineUserId=...`

## Fatigue Contract (P0)
- Fatigue is warn-only.
- No send blocking and no routing override.
- Existing reminder-side fatigue behavior remains unchanged.
- `sendNotification` may return add-only metadata:
  - `fatigueWarnEnabled`
  - `fatigueWarningCount`
  - `fatigueWarnings` (max 20 summarized entries)

## Feature Flags (P0)
- `ENABLE_UXOS_EVENTS_V1`
- `ENABLE_UXOS_NBA_V1`
- `ENABLE_UXOS_FATIGUE_WARN_V1`
- `ENABLE_UXOS_POLICY_READONLY_V1`

Default behavior:
- All disabled by default unless explicitly enabled.

## Rollback Contract
- Immediate stop by flag-off per capability.
- Full rollback by commit/PR revert.
- Sidecar data can remain after rollback because existing source-of-truth is unchanged.

## Addendum: Journey/Task Semantic Contracts (Phase746)
- Journey policy quiet-hours contract is standardized at `journeyPolicy.notificationCaps.quietHours`.
- `normalizeJourneyPolicy` must accept legacy shape (`notification_caps`, top-level `quietHours` / `quiet_hours`) and emit canonical `notificationCaps`.
- Task meaning contract includes add-only `task_contents.whyNow` as the first-class field for Task Detail semantics.
- Detailed references:
  - `docs/UX_OS_POLICY_CONTRACTS_V1.md`
  - `docs/UX_OS_MEANING_FIELDS_V1.md`
