# RUNBOOK_UX_OS_FOUNDATION_V1

Operational runbook for UX OS foundation-only (P0).

## Preflight
1. Confirm branch and clean tracked tree:
   - `git branch --show-current`
   - `git rev-parse HEAD`
   - `git status -sb`
2. Confirm docs contract:
   - `npm run test:docs`

## Feature Flag Operations
- UX events:
  - enable: `ENABLE_UXOS_EVENTS_V1=1`
  - disable: `ENABLE_UXOS_EVENTS_V1=0`
- NBA adapter/read route:
  - enable: `ENABLE_UXOS_NBA_V1=1`
  - disable: `ENABLE_UXOS_NBA_V1=0`
- Fatigue warning:
  - enable: `ENABLE_UXOS_FATIGUE_WARN_V1=1`
  - disable: `ENABLE_UXOS_FATIGUE_WARN_V1=0`
- Policy readonly pane:
  - enable: `ENABLE_UXOS_POLICY_READONLY_V1=1`
  - disable: `ENABLE_UXOS_POLICY_READONLY_V1=0`

## Verification Checklist
1. `ux_events` append path does not affect notification send success/failure outcomes.
2. `ux_events` append path does not affect reaction update outcomes.
3. Admin NBA route is GET-only and requires `x-actor`.
4. Admin NBA route writes audit entries with traceId.
5. Fatigue output is warning-only and does not block sends.
6. Policy pane is read-only and does not call write routes.
7. `GET /api/admin/os/notification-fatigue-warning` is read-only and writes view audit.

## Required Test Commands
- `npm run test:docs`
- `npm run test:admin-nav-contract`
- targeted UX OS tests (`node --test ...`) for:
  - flag helpers
  - ux event append/idempotency
  - NBA adapter route/read-only behavior
  - fatigue no-block behavior

## Immediate Rollback
1. Disable all UX OS foundation flags:
   - `ENABLE_UXOS_EVENTS_V1=0`
   - `ENABLE_UXOS_NBA_V1=0`
   - `ENABLE_UXOS_FATIGUE_WARN_V1=0`
   - `ENABLE_UXOS_POLICY_READONLY_V1=0`
2. Re-check:
   - `npm run test:docs`
   - smoke test for existing notifications and reaction flow

## Full Rollback
1. Revert the corresponding PR commit(s).
2. Re-run required tests and smoke checks.
3. Keep `ux_events` data as inert sidecar unless retention policy requires cleanup.
