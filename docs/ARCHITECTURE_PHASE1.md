# Architecture Boundaries Phase1

Linked Task: P1-001

## Responsibility Boundaries
- routes: HTTP handlers, request validation, response shaping only.
- usecases: business orchestration, scenario/step selection, validation calls.
- repos: data access (Firestore collections), no business rules.
- infra: external integrations (LINE SDK, storage, HTTP clients).
- apps: UI shells (admin, mini app), no direct data access.

## Dependency Direction
- UI (apps/*) -> API (routes) -> usecases -> repos/infra
- repos/infra must not depend on usecases or routes.
- Shared constants/validators live in src/domain.

## Phase1 Fixed Rules
- Link is `linkRegistryId` only (Phase0 Link Registry).
- user_checklists docId is `${lineUserId}__${checklistId}__${itemId}`.
- events.ref structure: `{ notificationId?, checklistId?, itemId? }`.
- events is append-only; failures must not break main flow.
- notification_deliveries records send fact only (separate from events).
- Next notification is manual (admin-created), no auto-selection.
- scenario/step mismatch: log only, do not display.
- ID generation happens in repository layer only.
- All timestamps use serverTimestamp; delete is avoided.

## Guardrails (Phase0 alignment)
- No side effects at import time.
- Entry point remains `src/index.js` only (do not add new listeners).
