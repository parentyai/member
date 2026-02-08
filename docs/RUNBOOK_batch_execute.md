# RUNBOOK_batch_execute

## Purpose
Define the safe, reproducible batch execute flow with dry-run, confirm token, and run progress tracking.

## Flow
1) Dry-run: confirm targets and obtain confirmToken.
2) Execute: start run with batchSize/rps and guard checks.
3) Monitor progress via run status API.
4) Review audit logs and run summary; aborts are recorded.
5) Rollback by reverting the implementation PR if needed.

## Safety Defaults
- automation OFF by default
- execute guard ON
- circuit breaker ON
- rate limit ON
