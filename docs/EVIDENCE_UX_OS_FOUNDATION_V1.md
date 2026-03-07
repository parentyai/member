# EVIDENCE_UX_OS_FOUNDATION_V1

Date: 2026-03-07

## Scope
- UX OS foundation-only (P0) evidence for PR0-PR5 hardening.
- add-only constraints maintained.
- non-touch list preserved (no webhook/emergency/journey command/rich-menu behavior change).

## Commit Chain
1. `ba014c75` PR0 docs hardening
2. `64c1a5d8` PR1 foundation contract + flags
3. `e50ef454` PR2 `ux_events` sidecar append-only
4. `cdff3cc3` PR3 canonical NBA adapter + read-only route
5. `5789269a` PR4 fatigue warn-only + policy console read-only surface

## Verification Commands
- `node --test tests/phase742/*.test.js tests/phase743/*.test.js tests/phase744/*.test.js tests/phase745/*.test.js tests/phase0/notifications.test.js tests/phase658/phase658_t03_reaction_v2_contract.test.js`
  - Result: PASS (42/42)
- `node --test tests/phase653/*.test.js tests/phase658/*.test.js tests/phase663/*.test.js tests/phase669/*.test.js tests/phase700/*.test.js tests/phase717/*.test.js tests/phase719/*.test.js tests/phase720/*.test.js tests/phase731/*.test.js tests/phase733/*.test.js`
  - Result: PASS (153/153)
- `npm run test:docs`
  - Result: PASS (`[docs] OK`)
- `npm run test:admin-nav-contract`
  - Result: PASS (133/133)

## Route Evidence (Read-Only)
- `GET /api/admin/os/next-best-action?lineUserId=...`
  - Contract: `x-actor` required, trace/request resolved, `appendAuditLog` action=`uxos.next_best_action.view`.
- `GET /api/admin/os/notification-fatigue-warning?lineUserId=...`
  - Contract: `x-actor` required, trace/request resolved, `appendAuditLog` action=`uxos.notification_fatigue_warning.view`.
  - Flag OFF response: `enabled=false`, `fallbackReason=ENABLE_UXOS_FATIGUE_WARN_V1_off`.
  - Flag ON response: warn-only payload, no write path.

## No-Block Evidence
- `sendNotification` with fatigue warn flag ON:
  - delivery succeeds even when fatigue computation throws.
  - result contains add-only metadata (`fatigueWarnEnabled`, `fatigueWarningCount`, `fatigueWarnings`).
  - no send gating/blocking introduced.

## Rollback Rehearsal
1. Immediate stop (flag-off):
   - `ENABLE_UXOS_EVENTS_V1=0`
   - `ENABLE_UXOS_NBA_V1=0`
   - `ENABLE_UXOS_FATIGUE_WARN_V1=0`
   - `ENABLE_UXOS_POLICY_READONLY_V1=0`
2. Verify:
   - `npm run test:docs`
   - `npm run test:admin-nav-contract`
3. Full rollback:
   - revert target PR commit(s) in reverse order.
   - sidecar `ux_events` is inert and can remain without SoT impact.

## Drift Check
- docs drift: none detected at evidence capture time (`npm run test:docs` PASS).
