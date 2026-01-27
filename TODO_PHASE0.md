# TODO Phase 0 Ledger

Linked Task: P0-003

## Backlog

## In Progress
## Done

### P0-001: Save SSOT snapshot to docs/SSOT_PHASE0.md
- Purpose: Preserve Phase0 SSOT as the single in-repo reference.
- Completion Criteria: docs/SSOT_PHASE0.md exists, header includes version/date/source, SSOT body unmodified.
- Dependencies: None.
- Edit Files: docs/SSOT_PHASE0.md
- Tests: None.
- Evidence: docs/SSOT_PHASE0.md
- Risks: Accidental edits to SSOT content.

### P0-002: Create guardrails doc
- Purpose: Lock rules (allowlist, prohibitions, entrypoint, CTA=1, KillSwitch).
- Completion Criteria: docs/GUARDRAILS_PHASE0.md exists with required sections.
- Dependencies: None.
- Edit Files: docs/GUARDRAILS_PHASE0.md
- Tests: None.
- Evidence: docs/GUARDRAILS_PHASE0.md
- Risks: Missing mandatory guardrail lines.

### P0-003: Create TODO ledger with required template
- Purpose: Single source of task tracking for Phase0.
- Completion Criteria: TODO_PHASE0.md has Backlog/In Progress/Done/Parking Lot and task templates.
- Dependencies: None.
- Edit Files: TODO_PHASE0.md
- Tests: None.
- Evidence: TODO_PHASE0.md
- Risks: Task IDs missing required fields.

### P0-004: Create traceability matrix
- Purpose: Enable SSOT -> implementation -> tests -> playbook tracing.
- Completion Criteria: docs/TRACEABILITY_PHASE0.md table covers SSOT sections with planned files/tests.
- Dependencies: P0-001.
- Edit Files: docs/TRACEABILITY_PHASE0.md
- Tests: None.
- Evidence: docs/TRACEABILITY_PHASE0.md
- Risks: Missing SSOT chapters or wrong file references.

### P0-005: Define architecture boundaries
- Purpose: Clarify layer responsibilities and dependency direction.
- Completion Criteria: docs/ARCHITECTURE_PHASE0.md exists with responsibilities and dependency flow.
- Dependencies: None.
- Edit Files: docs/ARCHITECTURE_PHASE0.md
- Tests: None.
- Evidence: docs/ARCHITECTURE_PHASE0.md
- Risks: Ambiguous layer separation.

### P0-006: Create Phase0 playbooks (Build/E2E/Debug/Incident)
- Purpose: Provide reproducible steps for build, E2E, debug, and incident response.
- Completion Criteria: docs/PLAYBOOK_PHASE0_BUILD.md, docs/PLAYBOOK_PHASE0_E2E.md, docs/PLAYBOOK_PHASE0_DEBUG.md, docs/PLAYBOOK_PHASE0_INCIDENT.md exist with placeholders.
- Dependencies: P0-001.
- Edit Files: docs/PLAYBOOK_PHASE0_BUILD.md, docs/PLAYBOOK_PHASE0_E2E.md, docs/PLAYBOOK_PHASE0_DEBUG.md, docs/PLAYBOOK_PHASE0_INCIDENT.md
- Tests: None.
- Evidence: docs/PLAYBOOK_PHASE0_BUILD.md, docs/PLAYBOOK_PHASE0_E2E.md, docs/PLAYBOOK_PHASE0_DEBUG.md, docs/PLAYBOOK_PHASE0_INCIDENT.md
- Risks: Steps too vague to operationalize later.

### P0-007: Create Runbook and Acceptance templates
- Purpose: Capture deploy/rollback/kill switch ops and acceptance checks.
- Completion Criteria: docs/RUNBOOK_PHASE0.md and docs/ACCEPTANCE_PHASE0.md exist with templates.
- Dependencies: P0-001.
- Edit Files: docs/RUNBOOK_PHASE0.md, docs/ACCEPTANCE_PHASE0.md
- Tests: None.
- Evidence: docs/RUNBOOK_PHASE0.md, docs/ACCEPTANCE_PHASE0.md
- Risks: Missing key ops sections (rollback, kill switch).

### P0-106: Implement Kill Switch
- Purpose: Block sends when Kill Switch is ON.
- Completion Criteria: Admin toggle + enforcement in send flow.
- Dependencies: P0-101.
- Edit Files: src/usecases/killSwitch/setKillSwitch.js, src/routes/admin/killSwitch.js, src/index.js, tests/phase0/killSwitch.test.js
- Tests: npm test
- Evidence: PR #23
- Risks: Sends allowed during ON.

### P0-105: Implement Link Registry CRUD + health check
- Purpose: Manage official links and WARN state.
- Completion Criteria: CRUD endpoints and manual health check available.
- Dependencies: P0-101.
- Edit Files: src/routes/admin/linkRegistry.js, src/usecases/linkRegistry/*.js, src/index.js, tests/phase0/linkRegistry.test.js
- Tests: npm test
- Evidence: PR #22
- Risks: WARN links accidentally usable.

### P0-103: Implement LINE push test send
- Purpose: Test send notifications to a specific user.
- Completion Criteria: Admin test send triggers LINE push + delivery log.
- Dependencies: P0-101.
- Edit Files: src/infra/lineClient.js, src/usecases/notifications/testSendNotification.js, src/routes/admin/notifications.js, src/index.js, tests/phase0/testSendNotification.test.js
- Tests: npm test
- Evidence: PR #21
- Risks: Token misconfiguration.

### P0-102: Implement LINE webhook (user creation)
- Purpose: Receive LINE events and create users.
- Completion Criteria: /webhook/line creates users with scenario/step defaults.
- Dependencies: P0-101.
- Edit Files: src/routes/webhookLine.js, src/usecases/users/ensureUser.js, src/index.js, tests/phase0/webhook.test.js
- Tests: npm test
- Evidence: PR #20
- Risks: Signature verification failure.

### P0-008: Create domain constants/validators skeletons
- Purpose: Define fixed keys and validation entry points without implementation.
- Completion Criteria: src/domain/constants.js and src/domain/validators.js exist with stub exports.
- Dependencies: None.
- Edit Files: src/domain/constants.js, src/domain/validators.js
- Tests: None.
- Evidence: src/domain/constants.js, src/domain/validators.js
- Risks: Stubs mistaken for implemented logic.

### P0-009: Create seed entry script skeleton
- Purpose: Provide seed entry point without data injection.
- Completion Criteria: scripts/seed_phase0.js exists and clearly no-ops.
- Dependencies: None.
- Edit Files: scripts/seed_phase0.js
- Tests: None.
- Evidence: scripts/seed_phase0.js
- Risks: Accidental side effects or data creation.

### P0-010: Add .env.example
- Purpose: Document required environment variables.
- Completion Criteria: .env.example exists with required keys only.
- Dependencies: None.
- Edit Files: .env.example
- Tests: None.
- Evidence: .env.example
- Risks: Missing required keys or extra keys.

### P0-011: Create tests/phase0 scaffolding
- Purpose: Provide minimal test harness skeleton.
- Completion Criteria: tests/phase0/README.md and tests/phase0/smoke.test.js exist and pass.
- Dependencies: None.
- Edit Files: tests/phase0/README.md, tests/phase0/smoke.test.js
- Tests: None.
- Evidence: tests/phase0/README.md, tests/phase0/smoke.test.js
- Risks: Skeleton incompatible with chosen test runner.

### P0-012: Add PR template
- Purpose: Enforce structured PR metadata and SSOT diff reporting.
- Completion Criteria: .github/PULL_REQUEST_TEMPLATE.md exists with required sections.
- Dependencies: None.
- Edit Files: .github/PULL_REQUEST_TEMPLATE.md
- Tests: None.
- Evidence: .github/PULL_REQUEST_TEMPLATE.md
- Risks: Missing mandatory fields (SSOT diff, rollback).

### P0-013: Create SSOT delta proposal log
- Purpose: Capture SSOT gaps/contradictions without changing SSOT.
- Completion Criteria: docs/SSOT_DELTA_PROPOSAL.md exists with template.
- Dependencies: P0-001.
- Edit Files: docs/SSOT_DELTA_PROPOSAL.md
- Tests: None.
- Evidence: docs/SSOT_DELTA_PROPOSAL.md
- Risks: Deltas tracked outside the SSOT delta log.

### P0-101: Implement Firestore repositories for Phase0 collections
- Purpose: CRUD for users, notifications, deliveries, link_registry, audit_logs, system_flags.
- Completion Criteria: Repo layer handles SSOT 6.6 schema with create/read/update patterns.
- Dependencies: P0-005.
- Edit Files: src/infra/firestore.js, src/repos/firestore/*.js, tests/phase0/*.test.js
- Tests: npm test
- Evidence: PR #19
- Risks: Schema drift vs SSOT.

### P0-120: Setup GCP IAM + GitHub Actions OIDC (WIF) + Cloud Run deploy workflow
- Purpose: Enable OIDC auth with deploy SA impersonation and document IAM steps.
- Completion Criteria: docs/GCP_SETUP.md and docs/GITHUB_SETUP.md updated; .github/workflows/deploy.yml added; npm test available.
- Dependencies: P0-001.
- Edit Files: docs/GCP_SETUP.md, docs/GITHUB_SETUP.md, .github/workflows/deploy.yml, package.json
- Tests: npm test
- Evidence: docs/GCP_SETUP.md, .github/workflows/deploy.yml, package.json
- Risks: IAM misconfiguration or missing required APIs.

### P0-121: Make Playbook/Runbook/Acceptance reproducible (remove TODOs)
- Purpose: Provide copy-paste-ready operational docs for Phase0.
- Completion Criteria: Playbooks/Runbook/Acceptance contain concrete steps and evidence fields with no TODOs.
- Dependencies: P0-006, P0-007.
- Edit Files: docs/PLAYBOOK_PHASE0_BUILD.md, docs/PLAYBOOK_PHASE0_E2E.md, docs/PLAYBOOK_PHASE0_DEBUG.md, docs/PLAYBOOK_PHASE0_INCIDENT.md, docs/RUNBOOK_PHASE0.md, docs/ACCEPTANCE_PHASE0.md
- Tests: npm test (doc-only change)
- Evidence: docs/PLAYBOOK_PHASE0_BUILD.md, docs/PLAYBOOK_PHASE0_E2E.md, docs/PLAYBOOK_PHASE0_DEBUG.md, docs/PLAYBOOK_PHASE0_INCIDENT.md, docs/RUNBOOK_PHASE0.md, docs/ACCEPTANCE_PHASE0.md
- Risks: Operational steps diverge from future implementation.

### P0-122: Traceability for SSOT 6.6-6.11
- Purpose: Map SSOT 6.6-6.11 to concrete files, tests, and playbooks with unimplemented status noted.
- Completion Criteria: docs/TRACEABILITY_PHASE0.md includes detailed mapping for 6.6-6.11 with file paths, function names, and test names.
- Dependencies: P0-004.
- Edit Files: docs/TRACEABILITY_PHASE0.md
- Tests: npm test (doc-only change)
- Evidence: docs/TRACEABILITY_PHASE0.md
- Risks: Planned file structure may need adjustment during implementation.

### P0-127: Record deploy rerun + PUBLIC_BASE_URL sync evidence
- Purpose: Capture deploy rerun evidence and align PUBLIC_BASE_URL with Cloud Run status.url.
- Completion Criteria: docs/GCP_SETUP.md includes rerun URL, status.url output, PUBLIC_BASE_URL update, and curl results.
- Dependencies: P0-120.
- Edit Files: docs/GCP_SETUP.md
- Tests: None.
- Evidence: docs/GCP_SETUP.md
- Risks: Org policy blocks public invoker; unauth 403 may persist.

### P0-129: Allow allUsers invoker for webhook (org policy exception)
- Purpose: Permit unauthenticated LINE webhook access via Cloud Run invoker exception.
- Completion Criteria: Org policy override applied, allUsers invoker binding succeeds, docs updated.
- Dependencies: P0-120.
- Edit Files: docs/GCP_SETUP.md, docs/ACCEPTANCE_PHASE0.md, docs/RUNBOOK_PHASE0.md, docs/PLAYBOOK_PHASE0_DEBUG.md
- Tests: None.
- Evidence: docs/GCP_SETUP.md
- Risks: Org policy change broadens IAM membership within project.

### P0-130: Webhook edge service (member-webhook)
- Purpose: Separate public webhook entrypoint from main service with signature verification.
- Completion Criteria: member-webhook deployed, unauth /healthz 200, /webhook/line rejects unsigned, docs updated.
- Dependencies: P0-120.
- Edit Files: src/index.js, docs/GCP_SETUP.md, docs/PLAYBOOK_PHASE0_BUILD.md, docs/PLAYBOOK_PHASE0_DEBUG.md, docs/RUNBOOK_PHASE0.md, docs/ACCEPTANCE_PHASE0.md
- Tests: None (manual curl + LINE console)
- Evidence: docs/GCP_SETUP.md
- Risks: Org policy blocks allUsers or webhook signature mismatch.

### P0-131: Record webhook edge evidence (deploy + checks)
- Purpose: Close evidence for member-webhook deployment and public access checks.
- Completion Criteria: docs/GCP_SETUP.md includes deploy run URL, service URL, curl checks, and invoker binding.
- Dependencies: P0-130.
- Edit Files: docs/GCP_SETUP.md, docs/ACCEPTANCE_PHASE0.md, docs/PLAYBOOK_PHASE0_BUILD.md, docs/RUNBOOK_PHASE0.md
- Tests: None.
- Evidence: docs/GCP_SETUP.md
- Risks: Health check path `/healthz` may be intercepted by GFE (use `/healthz/`).

### P0-132: Record LINE webhook verification success
- Purpose: Capture LINE Console verification success + Cloud Run accept logs.
- Completion Criteria: docs/GCP_SETUP.md and docs/ACCEPTANCE_PHASE0.md updated with evidence.
- Dependencies: P0-130.
- Edit Files: docs/GCP_SETUP.md, docs/ACCEPTANCE_PHASE0.md
- Tests: None.
- Evidence: docs/GCP_SETUP.md
- Risks: LINE Console verification not reproducible without valid channel secret.

### P0-133: Record final webhook URL + curl checks
- Purpose: Capture final member-webhook URL and curl results after merge.
- Completion Criteria: docs/GCP_SETUP.md, docs/ACCEPTANCE_PHASE0.md, docs/PLAYBOOK_PHASE0_BUILD.md updated with final URL.
- Dependencies: P0-130.
- Edit Files: docs/GCP_SETUP.md, docs/ACCEPTANCE_PHASE0.md, docs/PLAYBOOK_PHASE0_BUILD.md
- Tests: None.
- Evidence: docs/GCP_SETUP.md
- Risks: URL changes if service is recreated.

## Parking Lot



### P0-104: Implement admin notification creation + send flow
- Purpose: Admin can create/preview/send notifications.
- Completion Criteria: /admin/notifications create/list/send works with constraints.
- Dependencies: P0-101, P0-105.
- Edit Files: apps/admin/, src/ (routes/usecases)
- Tests: Admin API tests.
- Evidence: TODO.
- Risks: CTA/link validation gaps.



### P0-107: Implement mini app inbox + checklist
- Purpose: Show notifications and checklist per scenario/step.
- Completion Criteria: /inbox and /checklist render based on data.
- Dependencies: P0-101.
- Edit Files: apps/mini/.
- Tests: UI smoke tests.
- Evidence: TODO.
- Risks: Incorrect scenario/step selection.

### P0-108: Implement click tracking + redirect
- Purpose: Record clickAt and redirect to official URL.
- Completion Criteria: /track/click logs and redirects.
- Dependencies: P0-101, P0-105.
- Edit Files: src/ (routes/usecases/repos)
- Tests: Click tracking test.
- Evidence: TODO.
- Risks: Incorrect redirect or logging.

### P0-109: Implement audit logging
- Purpose: Record actor/action/entity for admin operations.
- Completion Criteria: audit_logs entries for all admin actions.
- Dependencies: P0-101.
- Edit Files: src/ (usecases/repos/infra)
- Tests: Audit log unit tests.
- Evidence: TODO.
- Risks: Missing logs for critical actions.

### P0-110: Implement first-time welcome message
- Purpose: Send initial message once after registration.
- Completion Criteria: Exactly one welcome message per user.
- Dependencies: P0-102, P0-103.
- Edit Files: src/ (usecases/infra)
- Tests: Welcome message idempotency test.
- Evidence: TODO.
- Risks: Duplicate welcome messages.
