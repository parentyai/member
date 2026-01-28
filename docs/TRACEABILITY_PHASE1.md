# Traceability Phase1

Linked Task: P1-003

## SSOT -> Implementation -> Tests -> Playbook

| SSOT Section | Planned Implementation Files | Planned Tests | Playbook Reference | Status |
| --- | --- | --- | --- | --- |
| 4. Data Model (FIX) | docs/DATA_MODEL_PHASE1.md | tests/phase1/data-model.test.js | docs/PLAYBOOK_PHASE1_BUILD.md | planned |
| 5. Link handling (linkRegistryId) | src/usecases/*, src/repos/firestore/* | tests/phase1/repo-contract.test.js | docs/PLAYBOOK_PHASE1_E2E.md | planned |
| 6. user_checklists docId | src/repos/firestore/userChecklistsRepo.js | tests/phase1/user-checklists.test.js | docs/PLAYBOOK_PHASE1_E2E.md | planned |
| 7. events.ref + type constraints | src/repos/firestore/eventsRepo.js, src/usecases/events/* | tests/phase1/events.test.js | docs/PLAYBOOK_PHASE1_E2E.md | planned |
| 8. notification_deliveries separation | src/repos/firestore/deliveriesRepo.js, src/usecases/notifications/* | tests/phase1/admin-notifications.test.js | docs/PLAYBOOK_PHASE1_E2E.md | planned |
| 8.1 Scenario-only targeting (step ignored) | src/usecases/notifications/sendNotificationPhase1.js, src/repos/firestore/usersPhase1Repo.js | tests/phase1/admin-notifications.test.js | docs/PLAYBOOK_PHASE1_E2E.md | planned |
| 9. ID generation (repo only) | src/repos/firestore/* | tests/phase1/repo-contract.test.js | docs/PLAYBOOK_PHASE1_BUILD.md | planned |
| 10. scenario/step resolution | src/usecases/* | tests/phase1/scenario-step.test.js | docs/PLAYBOOK_PHASE1_E2E.md | planned |
| 11. timestamp/delete rules | src/repos/firestore/* | tests/phase1/repo-contract.test.js | docs/PLAYBOOK_PHASE1_BUILD.md | planned |
| 12. Implementation rules | src/usecases/*, src/repos/firestore/* | tests/phase1/repo-contract.test.js | docs/PLAYBOOK_PHASE1_BUILD.md | planned |
| 14. Acceptance | docs/ACCEPTANCE_PHASE1.md | tests/phase1/smoke.test.js | docs/PLAYBOOK_PHASE1_E2E.md | planned |

## Notes
- File paths are placeholders until implementation begins.
- Phase0 files are immutable and are referenced only.
