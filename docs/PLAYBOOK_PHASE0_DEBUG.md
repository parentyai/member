# Playbook Phase0 Debug

Linked Task: P0-006, P0-121

## Common Failures

### LINE Webhook Signature
- Symptom: 401/403 on `/webhook/line`
- Cause: Invalid signature or wrong channel secret
- Fix: Verify `LINE_CHANNEL_SECRET` and signature middleware

### Permissions / Firestore
- Symptom: Permission denied on DB write
- Cause: Firestore rules or runtime SA missing `roles/datastore.user`
- Fix: Confirm runtime SA roles in project IAM

### ENV Missing
- Symptom: App fails on startup
- Cause: Required ENV not set
- Fix: Fill `.env` based on `.env.example`

### OIDC Auth Failure (CI)
- Symptom: `auth failed: workflow must specify exactly one of workload_identity_provider or credentials_json`
- Cause: `GCP_WIF_PROVIDER` not set or empty
- Fix: Set repo variable `GCP_WIF_PROVIDER` to provider resource name

### Cloud Run Deploy Failure
- Symptom: `PERMISSION_DENIED` during deploy
- Cause: Deploy SA missing `roles/run.admin` or `roles/iam.serviceAccountUser`
- Fix: Grant roles to deploy SA and retry

### Cloud Run 403 (Unauthenticated)
- Symptom: `403 Forbidden` when calling service URL without auth
- Cause: Org policy blocks public invoker (`allUsers`), or service is not public
- Fix:
  - Confirm `roles/run.invoker` includes `allUsers` for the webhook service
  - If blocked, request org policy exception and re-apply `allUsers`
  - Temporary workaround: use authenticated requests (`gcloud auth print-identity-token`)

## Minimal Checks
- `gcloud run services describe $SERVICE_NAME --region $GCP_REGION --project $GCP_PROJECT_ID`
- `gcloud projects get-iam-policy $GCP_PROJECT_ID --flatten="bindings[].members" --filter="member:member-deploy@..."`
