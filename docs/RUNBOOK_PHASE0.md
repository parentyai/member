# Runbook Phase0

Linked Task: P0-007, P0-121

## Deploy (GitHub Actions)
1) Open PR from `phase0/impl-p0-###-*` to `main`.
2) Ensure the `dry-run` job passes.
3) Merge PR to `main`.
4) Watch Actions -> "Deploy to Cloud Run" -> `deploy` job.

Expected:
- `deploy` job succeeds.
- Cloud Run revision is Ready.

## Verify Deploy
- Get service URL:
  - `SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$GCP_REGION" --project "$GCP_PROJECT_ID" --format "value(status.url)")`
- Verify HTTP endpoints:
  - `TOKEN=$(gcloud auth print-identity-token)`
  - `curl -sS -H "Authorization: Bearer $TOKEN" "$SERVICE_URL/"` returns `ok`
  - `curl -sS -H "Authorization: Bearer $TOKEN" "$SERVICE_URL/healthz"` returns JSON with `"ok":true`
- Optional (unauth check):
  - `curl -i "$SERVICE_URL/"` may return `403` when org policy blocks public invoker (expected in this environment).
- Check revisions:
  - `gcloud run revisions list --service "$SERVICE_NAME" --region "$GCP_REGION" --project "$GCP_PROJECT_ID" --limit=5`

Expected:
- Service URL resolves.
- Latest revision is Ready.

## Rollback

### Option A: Git revert (preferred)
1) `git revert <merge_commit_sha>`
2) Push branch, open PR, and merge.
3) Confirm `deploy` job succeeds.

### Option B: Cloud Run traffic rollback
1) List revisions:
   - `gcloud run revisions list --service "$SERVICE_NAME" --region "$GCP_REGION" --project "$GCP_PROJECT_ID" --limit=5`
2) Shift traffic to the previous revision:
   - `gcloud run services update-traffic "$SERVICE_NAME" --region "$GCP_REGION" --project "$GCP_PROJECT_ID" --to-revisions <REVISION>=100`

## Kill Switch Operations (available after P0-106)
1) Set Kill Switch to ON in admin settings.
2) Confirm send endpoints reject requests.
3) Record action in audit log.

## Post-Deploy Verification (Phase0)
- Actions `deploy` job is green.
- Cloud Run revision is Ready.
- If endpoints are implemented (P0-101+), run minimal checks:
  - Webhook returns 200 with valid signature.
  - Admin test send creates a delivery record.
