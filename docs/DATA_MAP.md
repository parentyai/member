# Data Map

This document describes what data the Member system stores, where it is stored, and how it is used.

## Scope
- App: Member (Cloud Run services: member / member-webhook / member-track)
- Storage: Firestore + Secret Manager + Cloud Logging

## Primary Identifiers
- `lineUserId`: LINE userId (primary key in Member)
- `memberNumber`: user-provided number (not verified by Member)
- `ridacMembershipIdHash`: HMAC-SHA256 of user-declared Ridac membership id (not reversible without secret)

## Stored Data (Firestore)
### `users/{lineUserId}`
Purpose: user profile + minimal state needed for operations.

Typical fields (not exhaustive):
- `scenarioKey`, `stepKey`: state for scenario/step routing
- `memberNumber`: user-provided number (string|null)
- `createdAt`: created timestamp
- `memberCardAsset`: member card asset reference (object|null)
- `ridacMembershipIdHash`: HMAC hash (string|null)
- `ridacMembershipIdLast4`: last 4 digits only (string|null)
- `ridacMembershipDeclaredAt`, `ridacMembershipDeclaredBy`: declaration timestamp + actor (`user`/`ops`)
- `ridacMembershipUnlinkedAt`, `ridacMembershipUnlinkedBy`: unlink timestamp + actor (`user`/`ops`)

Notes:
- Plaintext Ridac membership id is not stored.

### `ridac_membership_links/{ridacMembershipIdHash}`
Purpose: enforce uniqueness (one Ridac membership id can be linked to only one LINE user).

Fields:
- `ridacMembershipIdHash`: HMAC hash (doc id and field)
- `ridacMembershipIdLast4`: last 4 digits only
- `lineUserId`: linked LINE user
- `linkedAt`, `linkedBy`: link timestamp + actor (`user`/`ops`)

### `audit_logs/{id}`
Purpose: append-only audit trail for sensitive operations and decision traces.

Fields:
- `actor`, `action`, `entityType`, `entityId`
- `traceId`, `requestId`
- `payloadSummary` (should not contain plaintext secrets or full membership ids)
- `createdAt`

### `decision_logs/{id}` / `decision_timeline/{id}` / `ops_states/{lineUserId}`
Purpose: operations decisions, readiness, and state tracking.

### `events/{id}` / `notification_deliveries/{id}` / `notifications/{id}` / `checklists/*` / `user_checklists/*`
Purpose: product events, notification sends/reactions, and checklist progress.

## Secrets (Secret Manager)
Purpose: store secrets used by the system and CI deploy workflows.

Examples (stg):
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `ADMIN_OS_TOKEN`
- `TRACK_TOKEN_SECRET`
- `RIDAC_MEMBERSHIP_ID_HMAC_SECRET`

## Logs
### Cloud Logging
Purpose: operational logs for debugging and incident response.

Notes:
- Logs should not include plaintext secrets or full membership ids.

## Data Access & Authorization
- Cloud Run IAM controls who can invoke private services.
- App-layer admin token (`ADMIN_OS_TOKEN`) additionally protects `/admin/*` and `/api/admin/*`.
- Public services (`member-webhook`, `member-track`) accept only their service-mode endpoints.

## Retention & Deletion
- The codebase does not implement automatic TTL deletion for Firestore collections.
- Retention is therefore effectively indefinite unless GCP-level retention policies are configured separately.

### Operational Responsibility Split
- Application responsibility:
  - avoid storing plaintext secrets and full Ridac membership ids
  - append audit logs with traceId/requestId for sensitive operations
  - provide manual recovery and administrative controls via `/api/admin/*`
- Infrastructure responsibility:
  - define and enforce retention/backup/deletion policies in GCP (Firestore/Logging/Secret Manager)
  - maintain IAM least-privilege and service account boundaries between environments
  - maintain WIF/OIDC trust policy for CI deploy identities

### Minimum Deletion Runbook Inputs (for legal/ops review)
- Which collection(s) or log sink(s) are in scope
- Reason for deletion (request/incident/policy)
- Approval record (who approved, when)
- Execution evidence (traceId, command/run URL, resulting counts)
