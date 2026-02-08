# PHASE85_92_PLAN

## Purpose
Batch send execution is fixed as a resumable, observable run with safety-first rate limits, retry rules, circuit breaker, and progress reporting.

## Scope In
- Run SSOT (automation_runs) with resume cursor and counters.
- Batch sizing + rate limit enforcement on execute.
- Retry policy for transient LINE push failures.
- Partial failure completion + run summary (DONE_WITH_ERRORS).
- Circuit breaker with ABORTED + opsState escalation.
- Progress API and audit append on run start/done/abort.
- Docs + runbook.

## Scope Out
- UI changes.
- Automatic execution by default.
- Changes to existing API meanings.

## Tasks
- T85: automation_runs repo (create/patch/get).
- T86: rate limiter + batch progress updates.
- T87: retry policy for transient errors.
- T88: DONE_WITH_ERRORS summary.
- T89: circuit breaker with opsState escalation.
- T90: progress API.
- T91: audit append on run start/done/abort.
- T92: docs + runbook + tests.

## Done
- Run is resumable with counters + cursor and persisted.
- Rate limit, retry, circuit breaker, and partial failure summary are enforced.
- Progress API returns run status.
- Audit logs append on start/done/abort.
- Tests pass and docs exist.

## Rollback
- revert Phase85-92 implementation PR
- revert Phase85-92 CLOSE docs PR
