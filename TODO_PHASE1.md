# TODO Phase 1 Ledger

## Backlog

### P1-007: Phase1 E2E verification
- Purpose: Demonstrate end-to-end flow for admin and mini app.
- Completion Criteria: Playbook steps pass; evidence recorded.
- Dependencies: P1-004, P1-005, P1-006
- Edit Files: docs/PLAYBOOK_PHASE1_E2E.md, docs/ACCEPTANCE_PHASE1.md
- Tests: tests/phase1/smoke.test.js
- Evidence: TBD
- Risks: Missing instrumentation

## In Progress

### P1-006: Event logging integration
- Purpose: Record open/click/complete in events collection.
- Completion Criteria: events are appended without blocking main flow; ref structure valid.
- Dependencies: P1-003
- Edit Files: src/usecases/events/*, src/routes/phase1Events.js, src/index.js
- Tests: tests/phase1/events-integration.test.js
- Evidence: PR #TBD
- Risks: Error handling gaps

## Done

### P1-001: Phase1 docs scaffolding
- Purpose: Establish Phase1 SSOT/Architecture/Data Model/Traceability/Playbook/Runbook/Acceptance.
- Completion Criteria: All Phase1 docs exist and follow FIX rules.
- Dependencies: Phase0 CLOSE
- Edit Files: docs/SSOT_PHASE1.md, docs/ARCHITECTURE_PHASE1.md, docs/DATA_MODEL_PHASE1.md, docs/TRACEABILITY_PHASE1.md, docs/PLAYBOOK_PHASE1_BUILD.md, docs/PLAYBOOK_PHASE1_E2E.md, docs/RUNBOOK_PHASE1.md, docs/ACCEPTANCE_PHASE1.md
- Tests: None (doc-only)
- Evidence: PR #37
- Risks: Misalignment with FIX constraints

### P1-002: Firestore repositories (Phase1)
- Purpose: Implement repos for checklists, user_checklists, events (notification_deliveries uses existing Phase0 repo).
- Completion Criteria: CRUD methods exist and are unit-tested.
- Dependencies: P1-001
- Edit Files: src/repos/firestore/checklistsRepo.js, src/repos/firestore/userChecklistsRepo.js, src/repos/firestore/eventsRepo.js
- Tests: tests/phase1/*
- Evidence: PR #38
- Risks: Direct Firestore access bypassing repos

### P1-003: Usecases for checklist + events
- Purpose: Orchestrate checklist display/complete and event logging.
- Completion Criteria: Usecases call repos; events best-effort; type constraints enforced.
- Dependencies: P1-002
- Edit Files: src/usecases/checklists/*, src/usecases/events/*
- Tests: tests/phase1/usecases-*.test.js
- Evidence: PR #39
- Risks: Logging failure blocks main flow

### P1-004: Admin notification flow (minimal UI)
- Purpose: Create/send notifications from admin UI.
- Completion Criteria: Admin can create/send; deliveries created; scenario-only targeting.
- Dependencies: P1-003
- Edit Files: src/usecases/notifications/*, src/routes/admin/phase1Notifications.js, src/index.js
- Tests: tests/phase1/admin-notifications.test.js
- Evidence: PR #40
- Risks: Scenario-only targeting not enforced

### P1-005: Mini app checklist UI
- Purpose: Show checklist and toggle completion.
- Completion Criteria: Checklist renders; completion persists; mismatch hides UI.
- Dependencies: P1-003
- Edit Files: apps/mini/checklist_phase1.html, src/routes/phase1Mini.js, src/usecases/checklists/getChecklistWithStatus.js, src/index.js
- Tests: tests/phase1/mini-checklist.test.js
- Evidence: PR #41
- Risks: Scenario/step mismatch

## Parking Lot
