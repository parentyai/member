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
  - `curl -i "$SERVICE_URL/"` returns `403` (member service is private)
  - Authenticated check:
    - `curl -sS -H "Authorization: Bearer $(gcloud auth print-identity-token)" "$SERVICE_URL/"` returns `ok`
    - `curl -sS -H "Authorization: Bearer $(gcloud auth print-identity-token)" "$SERVICE_URL/healthz"` returns JSON with `"ok":true` (if 404, try `/healthz/`)
- Webhook edge service (public):
  - `WEBHOOK_URL=$(gcloud run services describe "member-webhook" --region "$GCP_REGION" --project "$GCP_PROJECT_ID" --format "value(status.url)")`
  - `curl -sS "$WEBHOOK_URL/healthz"` returns JSON with `"ok":true` (if 404, use `/healthz/`)
  - `curl -sS "$WEBHOOK_URL/healthz/"` returns JSON with `"ok":true`
  - `curl -i -X POST "$WEBHOOK_URL/webhook/line" -d '{}'` returns `401` (signature required)
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

## Redac Membership (Ops Unlink)
When duplicate rejection blocks a user (B policy), Ops can unlink the membership id.

Steps:
1) Proxy the member service:
   - `gcloud run services proxy member --project "$GCP_PROJECT_ID" --region "$GCP_REGION" --port 18080`
2) Open:
   - `http://127.0.0.1:18080/admin/login`
   - Login with `ADMIN_OS_TOKEN`.
3) Open:
   - `http://127.0.0.1:18080/admin/master`
4) In "Redacクラブ会員ID（例外解除）", input `redacMembershipId` (format `NN-NNNN`) and click `unlink`.

Expected:
- The unlink result returns `{ ok: true, lineUserId, redacMembershipIdLast4 }`.
- The previously blocked user can re-declare a different id.

Audit (trace):
- Use Trace Search (`/api/admin/trace?traceId=...`) and confirm `redac_membership.unlink_ok` exists with `redacMembershipIdLast4` (no plaintext id).

## Redac Membership (LINE User Commands)
User-side commands (LINE):
- `会員ID 00-0000`: self-declare membership id
- `会員ID 確認`: check current declaration status
- `会員ID` / `会員ID ヘルプ`: receive usage guidance

Expected replies:
- linked: completion message + next action (`会員ID 確認`)
- duplicate: already registered message (no owner info exposure)
- invalid format: example format guidance
- usage: registration + status command guidance
