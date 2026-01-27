# Phase0 Tests

Linked Task: P0-011

## Goal
Provide a minimal test scaffold for Phase0; no business logic yet.

## Scope (Now)
- Smoke test (always pass).
- Repo unit tests use an in-memory Firestore stub (no emulator).
- Webhook unit tests verify signature gating and user creation (stubbed Firestore).
- Test-send unit tests verify delivery creation (stubbed Firestore, push stub).
- No integration or E2E assertions.

## Scope (Next Phase)
- Webhook user creation
- Notification send -> delivery records
- Click tracking -> redirect
- Kill Switch block
- WARN link guard
 - Firestore emulator integration tests
