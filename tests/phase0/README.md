# Phase0 Tests

Linked Task: P0-011

## Goal
Provide a minimal test scaffold for Phase0; no business logic yet.

## Scope (Now)
- Smoke test (always pass).
- Repo unit tests use an in-memory Firestore stub (no emulator).
- Webhook unit tests verify signature gating and user creation (stubbed Firestore).
- Test-send unit tests verify delivery creation (stubbed Firestore, push stub).
- Link Registry unit tests verify WARN health storage (stubbed Firestore).
- Kill Switch unit tests verify toggle persistence (stubbed Firestore).
- Audit log unit tests verify append writes createdAt (stubbed Firestore).
- No integration or E2E assertions.

## Scope (Next Phase)
- Webhook user creation
- Notification send -> delivery records
- Click tracking -> redirect
- Kill Switch block
- WARN link guard
- Firestore emulator integration tests
