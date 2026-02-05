# TODO Phase21 (PREPARE)

## Backlog (ordered by value)

### P21-001: Produce a reliable denominator (sentCount) for CTA A/B
- Purpose: Ensure `sentCount` is available as a factual count alongside `clickCount` for `openA` / `openB`.
- Input: Existing notification send/test-send flow; existing identifiers already present in logs/stats.
- Output: Phase21 measurement produces non-negative `sentCount` and `clickCount` within a UTC window (no interpretation).
- Rollback: Revert the PR that introduced the change.

### P21-002: Ensure click tracking uses the public track surface consistently
- Purpose: Ensure users following CTA links do not hit IAM-blocked surfaces and can reach click tracking (facts only).
- Input: Existing `member-track` click endpoint and existing CTA link generation.
- Output: Generated click URLs consistently target the `member-track` host when configured; backward compatibility remains.
- Rollback: Revert the PR that introduced the change.

### P21-003: Lock invariants with minimal tests (anti-regression)
- Purpose: Detect unintended behavior changes (e.g., redirect semantics, count resets, schema breaks).
- Input: Existing test suite and minimal new test cases for CTA stats invariants.
- Output: CI fails when the fixed invariants are violated.
- Rollback: Revert the PR that introduced the tests.

### P21-004: Ops verification steps (runbook-level, factual)
- Purpose: Provide a single, reproducible verification path for ops to confirm counts are non-zero and traceable.
- Input: Existing scripts and log keys (requestId, deliveryId, linkRegistryId).
- Output: A factual verification procedure (no conclusions).
- Rollback: Revert the PR that introduced the documentation.

### P21-005: Evidence fixation (acceptance-level, factual)
- Purpose: Record observed facts (commands + outputs) required to declare Phase21 complete.
- Input: Outputs from the stats script and tracking endpoint responses.
- Output: Evidence block(s) containing UTC timestamps, commands, and raw outputs.
- Rollback: Revert the PR that recorded evidence.

## In Progress
- (none)

## Done
- (none)

