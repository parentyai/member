# TODO Phase 2 Ledger

## Backlog

### P2-006: Enable automation (flag ON)
- Purpose: Turn on Phase2 automation safely.
- Completion Criteria: Feature flag enables execution; dry-run can be toggled.
- Dependencies: P2-005
- Edit Files: ENV config only
- Tests: N/A (operational)
- Evidence: Pending
- Risks: Unintended execution

### P2-007: Phase2 E2E evidence
- Purpose: Record end-to-end evidence (dry-run + run log).
- Completion Criteria: Evidence recorded in docs.
- Dependencies: P2-006
- Edit Files: docs/* (Phase2)
- Tests: N/A (evidence)
- Evidence: Pending
- Risks: Missing proof

### P2-008: Phase2 CLOSE
- Purpose: Close Phase2 with immutable evidence.
- Completion Criteria: Docs updated and gate passed.
- Dependencies: P2-007
- Edit Files: docs/* (Phase2)
- Tests: N/A
- Evidence: Pending
- Risks: Premature close

## In Progress

### P2-001: SSOT Phase2
- Purpose: Fix Phase2 scope/boundaries.
- Completion Criteria: SSOT_PHASE2.md exists and matches FIX.
- Dependencies: None
- Edit Files: docs/SSOT_PHASE2.md
- Tests: None (doc-only)
- Evidence: PR TBD
- Risks: Scope drift

### P2-002: Architecture Phase2
- Purpose: Define automation boundary.
- Completion Criteria: ARCHITECTURE_PHASE2.md exists.
- Dependencies: P2-001
- Edit Files: docs/ARCHITECTURE_PHASE2.md
- Tests: None (doc-only)
- Evidence: PR TBD
- Risks: Incomplete boundary

### P2-003: Data Model Phase2
- Purpose: Define read-model collections.
- Completion Criteria: DATA_MODEL_PHASE2.md exists.
- Dependencies: P2-001
- Edit Files: docs/DATA_MODEL_PHASE2.md
- Tests: None (doc-only)
- Evidence: PR TBD
- Risks: Schema mismatch

### P2-004: TODO Phase2
- Purpose: Phase2 ledger.
- Completion Criteria: TODO_PHASE2.md exists with tasks.
- Dependencies: P2-001
- Edit Files: TODO_PHASE2.md
- Tests: None (doc-only)
- Evidence: PR TBD
- Risks: Missing tasks

### P2-005: Phase2 dry-run automation
- Purpose: Implement dry-run automation with idempotency.
- Completion Criteria: Dry-run returns summary, no writes; run log and reports for non-dry-run.
- Dependencies: P2-001..P2-004
- Edit Files: src/usecases/phase2/*, src/repos/firestore/*, src/routes/admin/*, src/index.js, tests/phase2/*
- Tests: tests/phase2/runAutomation.test.js
- Evidence: PR TBD
- Risks: Incorrect aggregation

## Done
