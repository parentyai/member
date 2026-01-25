# Architecture Boundaries Phase0

Linked Task: P0-005

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

## Guardrails
- No side effects at import time.
- Entry point remains `src/index.js` only (do not add new listeners).

