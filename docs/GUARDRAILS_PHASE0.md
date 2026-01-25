# Guardrails Phase0

Linked Task: P0-002

## Allowlist (New Directories)
- src/
- apps/admin/
- apps/mini/
- docs/
- scripts/
- tests/
- .github/
- Existing config files (minimal edits only)

## Prohibited in Phase0
- Functional implementation (send flows, full UI, DB logic)
- SSOT modifications (log deltas only)
- Deleting existing files or mass renames
- New entrypoints or additional listen() calls
- URL hardcoding inside notifications (must use Link Registry)

## Entrypoint Fixed
- Server entrypoint is only `src/index.js` (do not add others).

## URL Handling
- URL direct input in notifications is forbidden.
- Must reference Link Registry entries by registryId.

## CTA Rule
- CTA count is exactly 1 for every notification.

## Kill Switch Required
- Kill Switch must block any send when ON.

## Decision Rule
- 迷ったら送らない

