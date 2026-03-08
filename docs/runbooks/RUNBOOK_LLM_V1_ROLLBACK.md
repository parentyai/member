# RUNBOOK: LLM V1 Rollback

Use `tools/migrations/v1/rollback_v1.sh` values, redeploy, and verify:
- `/healthz` ok
- webhook accepts requests
- no new v1-only audit actions increasing unexpectedly
