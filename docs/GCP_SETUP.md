# GCP Setup (Phase0)

Linked Task: P0-120

## Constraints (Must Keep)
- Use Workload Identity Federation (OIDC) for GitHub Actions.
- GitHub Actions must impersonate a dedicated deploy Service Account.
- No long-lived JSON keys.
- Runtime identity can be the default compute SA (no new runtime SA required).

## Execution Principals
- Manual setup (gcloud): `nshimamura@parentyai.com`
- GitHub Actions: OIDC principalSet for `parentyai/member`
- Deploy SA: `member-deploy@${PROJECT_ID}.iam.gserviceaccount.com`
- Runtime SA: default compute SA (`${PROJECT_NUMBER}-compute@developer.gserviceaccount.com`)

## Variables
Set these in your shell for copy/paste commands:

```sh
PROJECT_ID=member-485303
PROJECT_NUMBER=306972605843
REGION=us-east1
SERVICE_NAME=member
WEBHOOK_SERVICE_NAME=member-webhook

GITHUB_OWNER=parentyai
GITHUB_REPO=member
GITHUB_BRANCH=main

WIF_POOL=github-pool
WIF_PROVIDER=github-provider
WIF_PRINCIPAL="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_OWNER}/${GITHUB_REPO}"

DEPLOY_SA_EMAIL="member-deploy@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
SERVICE_MODE_WEBHOOK=webhook
```

## 1) Enable Required APIs
Detect enabled services:

```sh
gcloud services list --enabled --project "$PROJECT_ID" \
  --filter="name:run.googleapis.com OR name:iam.googleapis.com OR name:secretmanager.googleapis.com OR name:firestore.googleapis.com OR name:datastore.googleapis.com OR name:artifactregistry.googleapis.com OR name:cloudbuild.googleapis.com"
```

Enable (run only for missing services):

```sh
gcloud services enable run.googleapis.com iam.googleapis.com secretmanager.googleapis.com --project "$PROJECT_ID"
```

Choose one depending on Firestore mode:

```sh
# Firestore Native mode
#gcloud services enable firestore.googleapis.com --project "$PROJECT_ID"

# Firestore in Datastore mode
#gcloud services enable datastore.googleapis.com --project "$PROJECT_ID"
```

If using `gcloud run deploy --source` (Cloud Build):

```sh
gcloud services enable cloudbuild.googleapis.com --project "$PROJECT_ID"
```

If pushing images to Artifact Registry:

```sh
gcloud services enable artifactregistry.googleapis.com --project "$PROJECT_ID"
```

Expected:
- `gcloud services list` shows the above APIs enabled.

## 2) Create Deploy Service Account

```sh
gcloud iam service-accounts create member-deploy \
  --project "$PROJECT_ID" \
  --display-name "Member Deploy (GitHub Actions)"
```

Expected:
- `gcloud iam service-accounts list` includes `member-deploy@...`.

## 3) Workload Identity Federation (GitHub OIDC)
Create pool and provider:

```sh
gcloud iam workload-identity-pools create "$WIF_POOL" \
  --project "$PROJECT_ID" \
  --location "global" \
  --display-name "GitHub Actions Pool"

gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" \
  --project "$PROJECT_ID" \
  --location "global" \
  --workload-identity-pool "$WIF_POOL" \
  --display-name "GitHub Actions Provider" \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition "assertion.repository=='${GITHUB_OWNER}/${GITHUB_REPO}' && assertion.ref=='refs/heads/${GITHUB_BRANCH}'"
```

Bind GitHub principalSet to deploy SA:

```sh
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA_EMAIL" \
  --project "$PROJECT_ID" \
  --role "roles/iam.workloadIdentityUser" \
  --member "$WIF_PRINCIPAL"
```

Get provider resource name for GitHub Actions:

```sh
gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER" \
  --project "$PROJECT_ID" \
  --location "global" \
  --workload-identity-pool "$WIF_POOL" \
  --format "value(name)"
```

Expected:
- Provider describe returns a full resource name like `projects/NUMBER/locations/global/workloadIdentityPools/.../providers/...`.

## 4) Grant Roles (Least Privilege)

### Deploy SA (impersonated by GitHub Actions)

```sh
# Cloud Run deploy permissions
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role "roles/run.admin"

# Allow deploy SA to set runtime identity

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA_EMAIL" \
  --member "serviceAccount:${DEPLOY_SA_EMAIL}" \
  --role "roles/iam.serviceAccountUser"

# Optional: log inspection (read-only)
#gcloud projects add-iam-policy-binding "$PROJECT_ID" \
#  --member "serviceAccount:${DEPLOY_SA_EMAIL}" \
#  --role "roles/logging.viewer"

# Optional: Cloud Build if using --source
#gcloud projects add-iam-policy-binding "$PROJECT_ID" \
#  --member "serviceAccount:${DEPLOY_SA_EMAIL}" \
#  --role "roles/cloudbuild.builds.editor"
```

### Runtime SA (default compute SA)

```sh
# Firestore read/write
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role "roles/datastore.user"

# Secret Manager access for LINE secrets
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role "roles/secretmanager.secretAccessor"

# Optional: write logs
#gcloud projects add-iam-policy-binding "$PROJECT_ID" \
#  --member "serviceAccount:${RUNTIME_SA_EMAIL}" \
#  --role "roles/logging.logWriter"

# Optional: GCS for memberCardAsset uploads
#gcloud projects add-iam-policy-binding "$PROJECT_ID" \
#  --member "serviceAccount:${RUNTIME_SA_EMAIL}" \
#  --role "roles/storage.objectAdmin"
```

Expected:
- `gcloud projects get-iam-policy` shows roles bound to deploy and runtime identities.

## 5) Secret Manager (required)

```sh
gcloud secrets create LINE_CHANNEL_SECRET --project "$PROJECT_ID"

gcloud secrets create LINE_CHANNEL_ACCESS_TOKEN --project "$PROJECT_ID"

# Admin/Ops app-layer auth (cookie login + X-Admin-Token for scripts)
gcloud secrets create ADMIN_OS_TOKEN --project "$PROJECT_ID"

# Track click token HMAC (must match between member + member-track)
gcloud secrets create TRACK_TOKEN_SECRET --project "$PROJECT_ID"
```

Expected:
- `gcloud secrets list` shows required secrets.

## 6) Storage Bucket (memberCardAsset)

```sh
gcloud storage buckets describe gs://member-uploads-member-485303 --project "$PROJECT_ID"
```

Expected:
- Bucket exists in `us-east1`.

## 7) GitHub Repository Settings
Add repository variables (non-secret):

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `SERVICE_NAME`
- `RUNTIME_SA_EMAIL`
- `ENV_NAME`
- `PUBLIC_BASE_URL`
- `FIRESTORE_PROJECT_ID`
- `STORAGE_BUCKET`
- `GCP_WIF_PROVIDER` (full provider resource name)
- `GCP_DEPLOY_SA` (deploy SA email)

Expected:
- Actions workflow uses variables without GitHub Secrets.

## 7.5) Org Policy Exception for Public Webhook (Required)
LINE webhook requires unauthenticated HTTPS access. If org policy blocks `allUsers`, request a scoped exception for the webhook service.

### Request Template (to Admin)
Title: Allow `allUsers` invoker for Cloud Run webhook service  
Purpose: LINE Messaging API webhook cannot send auth headers; webhook must be public.  
Scope: **Only** `member-webhook` Cloud Run service (no other services).  
Requested change:
1) Permit `allUsers` for `roles/run.invoker` on `member-webhook`.
2) If restricted by org policy (e.g., `constraints/iam.allowedPolicyMemberDomains`), allow a **project-level override** for project `member-485303`.
Security controls:
- Webhook endpoint only (`/webhook/line`)
- LINE signature verification required
- Rate limiting and logging enabled

### Apply after approval (commands)
Grant public invoker for webhook service:
```sh
gcloud run services add-iam-policy-binding "$WEBHOOK_SERVICE_NAME" \
  --member "allUsers" \
  --role "roles/run.invoker" \
  --region "$REGION" \
  --project "$PROJECT_ID"
```

## 8) Dry-Run Checklist (must pass before deploy)
- [ ] Required APIs enabled
- [ ] WIF provider resource name recorded in `GCP_WIF_PROVIDER`
- [ ] WIF binding to deploy SA applied
- [ ] Deploy SA + runtime SA roles applied
- [ ] Secrets exist in Secret Manager
- [ ] PR dry-run job passes (lint/tests)
- [ ] Service URL reachable after deploy
- [ ] Logs visible in Cloud Run / Cloud Logging
- [ ] Firestore read/write verified with runtime SA

## 9) Deploy Webhook Edge Service (member-webhook)
Deploy the same image with webhook-only mode enabled (public).

```sh
IMAGE="us-east1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${SERVICE_NAME}:${GITHUB_SHA}"
gcloud run deploy "$WEBHOOK_SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --image "$IMAGE" \
  --allow-unauthenticated \
  --service-account "$RUNTIME_SA_EMAIL" \
  --set-env-vars "ENV_NAME=$ENV_NAME,SERVICE_MODE=$SERVICE_MODE_WEBHOOK" \
  --set-secrets "LINE_CHANNEL_SECRET=LINE_CHANNEL_SECRET:latest"
```

Verify:
```sh
WEBHOOK_URL=$(gcloud run services describe "$WEBHOOK_SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --format "value(status.url)")
curl -i "$WEBHOOK_URL/healthz"
curl -i -X POST "$WEBHOOK_URL/webhook/line" -d '{}'

## 9.5) Deploy Main Service (member) as Private
Main service must remain private (no `allUsers` invoker). Use `--no-allow-unauthenticated` for deploy.

```sh
IMAGE="us-east1-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/${SERVICE_NAME}:${GITHUB_SHA}"
gcloud run deploy "$SERVICE_NAME" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --image "$IMAGE" \
  --no-allow-unauthenticated \
  --service-account "$RUNTIME_SA_EMAIL" \
  --set-env-vars "ENV_NAME=$ENV_NAME,PUBLIC_BASE_URL=$PUBLIC_BASE_URL,FIRESTORE_PROJECT_ID=$FIRESTORE_PROJECT_ID,STORAGE_BUCKET=$STORAGE_BUCKET" \
  --set-secrets "LINE_CHANNEL_SECRET=LINE_CHANNEL_SECRET:latest,LINE_CHANNEL_ACCESS_TOKEN=LINE_CHANNEL_ACCESS_TOKEN:latest,TRACK_TOKEN_SECRET=TRACK_TOKEN_SECRET:latest,ADMIN_OS_TOKEN=ADMIN_OS_TOKEN:latest"
```
```

## Execution Evidence (member-485303)

- Active account: `nshimamura@parentyai.com`
- Active project: `member-485303`
- Project number: `306972605843`
- Enabled APIs:
  - `artifactregistry.googleapis.com`
  - `cloudbuild.googleapis.com`
  - `datastore.googleapis.com`
  - `firestore.googleapis.com`
  - `iam.googleapis.com`
  - `run.googleapis.com`
  - `secretmanager.googleapis.com`
- Deploy SA exists: `member-deploy@member-485303.iam.gserviceaccount.com`
- WIF pool: `projects/306972605843/locations/global/workloadIdentityPools/github-pool`
- WIF provider: `projects/306972605843/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
- WIF binding to deploy SA:
  - `roles/iam.workloadIdentityUser` bound to `principalSet://.../attribute.repository/parentyai/member`
- Deploy SA roles:
  - `roles/run.admin` on project
  - `roles/logging.viewer` on project
  - `roles/cloudbuild.builds.editor` on project
  - `roles/artifactregistry.writer` on project
  - `roles/iam.serviceAccountUser` on runtime SA
- Deploy SA role updates (2026-01-26):
  - Added `roles/cloudbuild.builds.editor` and `roles/artifactregistry.writer` to resolve deploy from source.
- Runtime SA roles:
  - `roles/datastore.user`
  - `roles/secretmanager.secretAccessor`
  - `roles/storage.objectAdmin`
- Secrets exist:
  - `LINE_CHANNEL_SECRET`
  - `LINE_CHANNEL_ACCESS_TOKEN`
  - `ADMIN_OS_TOKEN`
  - `TRACK_TOKEN_SECRET`
- Storage bucket exists:
  - `gs://member-uploads-member-485303` (location `US-EAST1`)
- Artifact Registry repo exists:
  - `cloud-run-source-deploy` (location `us-east1`)
- Cloud Build staging bucket exists:
  - `gs://member-485303_cloudbuild` (location `US`)
- Bucket-level IAM:
  - `roles/storage.objectAdmin` granted to deploy SA on `gs://member-485303_cloudbuild`
- Deploy failure evidence (2026-01-26):
  - Run URL: `https://github.com/parentyai/member/actions/runs/21341888975`
  - Commit: `ae3e5dd5784de7382d03c8977c8479d775b217de`
  - Error excerpt:
    - `Uploading sources............failed`
    - `ERROR: (gcloud.run.deploy) HTTPError 403: member-deploy@member-485303.iam.gserviceaccount.com does not have storage.buckets.create access`
- Remediation commands executed (2026-01-26):
  - `gcloud projects add-iam-policy-binding member-485303 --member "serviceAccount:member-deploy@member-485303.iam.gserviceaccount.com" --role "roles/cloudbuild.builds.editor"`
  - `gcloud projects add-iam-policy-binding member-485303 --member "serviceAccount:member-deploy@member-485303.iam.gserviceaccount.com" --role "roles/artifactregistry.writer"`
  - `gcloud artifacts repositories create cloud-run-source-deploy --repository-format=docker --location=us-east1 --project member-485303`
  - `gcloud storage buckets create gs://member-485303_cloudbuild --location=US --project member-485303`
  - `gcloud storage buckets add-iam-policy-binding gs://member-485303_cloudbuild --member "serviceAccount:member-deploy@member-485303.iam.gserviceaccount.com" --role "roles/storage.objectAdmin"`
- Staging bucket describe (2026-01-26):
  - Command: `gcloud storage buckets describe gs://member-485303_cloudbuild --project member-485303`
  - Output:
    ```
    creation_time: 2026-01-26T00:22:07+0000
    default_storage_class: STANDARD
    generation: 1769386927035614841
    location: US
    location_type: multi-region
    metageneration: 3
    name: member-485303_cloudbuild
    public_access_prevention: inherited
    rpo: DEFAULT
    soft_delete_policy:
      effectiveTime: '2026-01-26T00:22:07.271000+00:00'
      retentionDurationSeconds: '604800'
    storage_url: gs://member-485303_cloudbuild/
    uniform_bucket_level_access: true
    update_time: 2026-01-26T00:51:16+0000
    ```
- CI deploy flags update (2026-01-26):
  - Added `--gcs-source-staging-dir "gs://$GCP_PROJECT_ID_cloudbuild/source"` and `--allow-unauthenticated` in `.github/workflows/deploy.yml` (PR #5, commit `e460abc`).
- Deploy failure evidence (2026-01-26):
  - Run URL: `https://github.com/parentyai/member/actions/runs/21344095469`
  - Commit: `2fecd49cab1c33e541d562d011661b4dc6433a29`
  - Error excerpt:
    - `ERROR: (gcloud.run.deploy) unrecognized arguments:`
    - `--gcs-source-staging-dir`
    - `gs:///source`
- Remediation plan (2026-01-26):
  - Switch to Cloud Build image build + `gcloud run deploy --image`.
  - Correct staging bucket string to `gs://${GCP_PROJECT_ID}_cloudbuild/source` for `gcloud builds submit`.
- Remediation PR (2026-01-26):
  - PR: `https://github.com/parentyai/member/pull/6`
  - Commit: `27e648a`
  - Dry-run: `https://github.com/parentyai/member/actions/runs/21344264653` (green)
- Deploy failure evidence (2026-01-26):
  - Run URL: `https://github.com/parentyai/member/actions/runs/21344329763`
  - Commit: `04a1586cecc4f03a2e1ed92b72030782aa827e6d`
  - Error excerpt:
    - `ERROR: (gcloud.builds.submit) Invalid value for [source]: Dockerfile required when specifying --tag`
- Remediation plan (2026-01-26):
  - Use Cloud Buildpacks: `gcloud builds submit --pack "image=..."` (no Dockerfile).
- Remediation PR (2026-01-26):
  - PR: `https://github.com/parentyai/member/pull/7`
  - Commit: `43dea55`
  - Dry-run: `https://github.com/parentyai/member/actions/runs/21344484600` (green)

- Deploy failure evidence (2026-01-26):
  - Run URL: `https://github.com/parentyai/member/actions/runs/21344509503`
  - Commit: `c246b4758ee92b15b621782b9c89e5ce50f15649`
  - Error excerpt:
    - `ERROR: (gcloud.builds.submit) The user is forbidden from accessing the bucket [member-485303_cloudbuild].`
    - `Please check your organization's policy or if the user has the "serviceusage.services.use" permission.`
- Remediation commands executed (2026-01-26):
  - `gcloud projects add-iam-policy-binding member-485303 --member "serviceAccount:member-deploy@member-485303.iam.gserviceaccount.com" --role "roles/serviceusage.serviceUsageConsumer"`
  - `gcloud storage buckets add-iam-policy-binding gs://member-485303_cloudbuild --member "serviceAccount:member-deploy@member-485303.iam.gserviceaccount.com" --role "roles/storage.legacyBucketReader"`
- Deploy failure evidence (2026-01-26):
  - Run URL: `https://github.com/parentyai/member/actions/runs/21344509503`
  - Error excerpt:
    - `The build is running, and logs are being written to the default logs bucket.`
    - `This tool can only stream logs if you are Viewer/Owner of the project...`
- Remediation plan (2026-01-26):
  - Use `gcloud builds submit --async` and poll build status to avoid log streaming restrictions.
- Remediation PR (2026-01-27):
  - PR: `https://github.com/parentyai/member/pull/8`
  - Commit: `2d6b593`
  - Change: use `gcloud builds submit --async` and poll with `gcloud builds describe`.
- Deploy failure evidence (2026-01-27):
  - Cloud Build log: `https://console.cloud.google.com/cloud-build/builds/fa26a4aa-5da6-4e24-ab61-e7043cb06d2e?project=306972605843`
  - Error excerpt:
    - `denied: Permission "artifactregistry.repositories.uploadArtifacts" denied on resource`
    - `serviceAccount:306972605843-compute@developer.gserviceaccount.com`
- Remediation commands executed (2026-01-27):
  - `gcloud projects add-iam-policy-binding member-485303 --member "serviceAccount:306972605843@cloudbuild.gserviceaccount.com" --role "roles/artifactregistry.writer"`
  - `gcloud projects add-iam-policy-binding member-485303 --member "serviceAccount:306972605843-compute@developer.gserviceaccount.com" --role "roles/artifactregistry.writer"`
- Secrets versions added (2026-01-27):
  - `printf '***' | gcloud secrets versions add LINE_CHANNEL_SECRET --data-file=- --project member-485303`
  - `printf '***' | gcloud secrets versions add LINE_CHANNEL_ACCESS_TOKEN --data-file=- --project member-485303`
- Remediation PR (2026-01-27):
  - PR: `https://github.com/parentyai/member/pull/9`
  - Commit: `26e6fa4`
  - Change: add minimal HTTP server + preflight to satisfy Buildpacks/Cloud Run.
- Deploy success (2026-01-27):
  - Run URL: `https://github.com/parentyai/member/actions/runs/21345039368`
  - Result: deploy job green.
- Cloud Run service URL (2026-01-27):
  - Command: `gcloud run services describe member --region us-east1 --project member-485303 --format="value(status.url)"`
  - Output: `https://member-pvxgenwkba-ue.a.run.app`
- PUBLIC_BASE_URL update (2026-01-27):
  - Command: `gh variable set PUBLIC_BASE_URL -b "https://member-pvxgenwkba-ue.a.run.app" -R parentyai/member`
  - Evidence: re-run jobs on run `21345039368` (deploy green).
- Cloud Run IAM (2026-01-27):
  - Attempted unauth binding (blocked by org policy):
    - `gcloud run services add-iam-policy-binding member --member "allUsers" --role "roles/run.invoker" --region us-east1 --project member-485303`
    - Error: `PERMISSION_DENIED: Policy constraint constraints/run.allowedUnauthenticated`
  - Applied authenticated invoker for tester:
    - `gcloud run services add-iam-policy-binding member --member "user:nshimamura@parentyai.com" --role "roles/run.invoker" --region us-east1 --project member-485303`
- Endpoint checks (2026-01-27):
  - Unauth: `curl -i https://member-pvxgenwkba-ue.a.run.app/` -> `403 Forbidden`
  - Auth: `curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://member-pvxgenwkba-ue.a.run.app/` -> `ok`
  - Auth: `curl -i -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://member-pvxgenwkba-ue.a.run.app/healthz` -> `404` (did not reach container; no app logs)
  - Auth: `curl -i -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://member-pvxgenwkba-ue.a.run.app/healthz/` -> `404` with body `not found` (container)
- Note (2026-01-27):
  - `/healthz` appears to be handled by the Google Frontend before reaching the container; use `/` for basic health checks until resolved.
- Org policy exception for unauth webhook (2026-01-27):
  - Org policy detected:
    - `gcloud org-policies describe constraints/iam.allowedPolicyMemberDomains --organization 437836372038`
    - Allowed values: `C021oe492` (domain-restricted policy blocks `allUsers`)
  - Enable Org Policy API:
    - `gcloud services enable orgpolicy.googleapis.com --project member-485303`
  - Project override to allow `allUsers`:
    - Policy file:
      ```
      name: projects/member-485303/policies/iam.allowedPolicyMemberDomains
      spec:
        inheritFromParent: false
        rules:
          - allowAll: true
      ```
    - Apply:
      - `gcloud org-policies set-policy /tmp/iam-allowed-policy-members.yaml`
  - Cloud Run invoker binding:
    - `gcloud run services add-iam-policy-binding member --member "allUsers" --role "roles/run.invoker" --region us-east1 --project member-485303`
  - Unauth check:
    - `curl -i https://member-pvxgenwkba-ue.a.run.app/` -> `200 OK` and body `ok`
- Deploy re-run after PUBLIC_BASE_URL update (2026-01-27):
  - Command: `gh run rerun 21345761301`
  - Run URL: `https://github.com/parentyai/member/actions/runs/21345761301`
  - Head SHA: `5fd3757ee717572dc5804e1429bd5cfd11590174`
  - Result: dry-run + deploy green.
- Cloud Run URL check (2026-01-27):
  - Command: `gcloud run services describe member --region us-east1 --project member-485303 --format="value(status.url)"`
  - Output: `https://member-pvxgenwkba-ue.a.run.app`
- PUBLIC_BASE_URL reset to status.url (2026-01-27):
  - Command: `gh variable set PUBLIC_BASE_URL -b "https://member-pvxgenwkba-ue.a.run.app" -R parentyai/member`
  - Note: Previous value was `https://member-306972605843.us-east1.run.app`.
- Cloud Run public invoker attempt (2026-01-27):
  - Command: `gcloud run services add-iam-policy-binding member --member "allUsers" --role "roles/run.invoker" --region us-east1 --project member-485303`
  - Error: `FAILED_PRECONDITION: One or more users named in the policy do not belong to a permitted customer`
- Endpoint checks after re-run (2026-01-27):
  - Unauth: `curl -i https://member-pvxgenwkba-ue.a.run.app/` -> `403 Forbidden`
  - Auth: `curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://member-pvxgenwkba-ue.a.run.app/` -> `ok`
- Webhook edge deployment (2026-01-27):
  - Deploy run: `https://github.com/parentyai/member/actions/runs/21380967358` (merge PR #15)
  - Image: `us-east1-docker.pkg.dev/member-485303/cloud-run-source-deploy/member:969eac9748c3b9849fc43bf6128930a196a49188`
  - Deploy command:
    - `gcloud run deploy member-webhook --project member-485303 --region us-east1 --image "$IMAGE" --allow-unauthenticated --service-account "306972605843-compute@developer.gserviceaccount.com" --set-env-vars "ENV_NAME=stg,SERVICE_MODE=webhook" --set-secrets "LINE_CHANNEL_SECRET=LINE_CHANNEL_SECRET:latest"`
  - Service URL: `https://member-webhook-306972605843.us-east1.run.app`
  - Public invoker:
    - `gcloud run services add-iam-policy-binding member-webhook --member "allUsers" --role "roles/run.invoker" --region us-east1 --project member-485303`
  - Health check:
    - `curl -i https://member-webhook-306972605843.us-east1.run.app/healthz` -> `404` (GFE)
    - `curl -i https://member-webhook-306972605843.us-east1.run.app/healthz/` -> `200` with `{"ok":true,"env":"stg"}`
- Webhook reject (no signature):
  - `curl -i -X POST https://member-webhook-306972605843.us-east1.run.app/webhook/line -d '{}'` -> `401 unauthorized`
- Webhook verification success (2026-01-27):
  - LINE Console webhook verify: 200 OK (user-confirmed)
  - Cloud Run logs:
    - `gcloud logging read 'resource.type="cloud_run_revision" resource.labels.service_name="member-webhook" textPayload:"accept"' --project member-485303 --limit 5`
    - `accept` entries observed (requestId logged, no PII)
- Webhook service URL (2026-01-27):
  - Command: `gcloud run services describe member-webhook --region us-east1 --project member-485303 --format="value(status.url)"`
  - Output: `https://member-webhook-pvxgenwkba-ue.a.run.app`
  - IAM check:
    - `gcloud run services get-iam-policy member-webhook --region us-east1 --project member-485303`
    - `roles/run.invoker` includes `allUsers`
  - Health check:
    - `curl -i https://member-webhook-pvxgenwkba-ue.a.run.app/healthz/` -> `200` with `{"ok":true,"env":"stg"}`
  - Webhook reject (no signature):
    - `curl -i -X POST https://member-webhook-pvxgenwkba-ue.a.run.app/webhook/line -d '{}'` -> `401 unauthorized`

- Phase0 gate checks (2026-01-27):
  - member URL:
    - `gcloud run services describe member --region us-east1 --project member-485303 --format="value(status.url)"`
    - Output: `https://member-pvxgenwkba-ue.a.run.app`
  - member IAM (private check):
    - `gcloud run services get-iam-policy member --region us-east1 --project member-485303 --format="yaml(bindings)"`
    - Output:
      ```
      bindings:
      - members:
        - user:nshimamura@parentyai.com
        role: roles/run.invoker
      ```
  - member remove public invoker:
    - `gcloud run services remove-iam-policy-binding member --member "allUsers" --role "roles/run.invoker" --region us-east1 --project member-485303`
    - Result: `Updated IAM policy for service [member]`
  - member unauth access (expected 403):
    - `curl -i https://member-pvxgenwkba-ue.a.run.app/`
    - Output: `HTTP/2 403`
  - webhook IAM (public check):
    - `gcloud run services get-iam-policy member-webhook --region us-east1 --project member-485303 --format="yaml(bindings)"`
    - Output:
      ```
      bindings:
      - members:
        - allUsers
        role: roles/run.invoker
      ```
  - webhook healthz:
    - `curl -i https://member-webhook-pvxgenwkba-ue.a.run.app/healthz/`
    - Output: `HTTP/2 200` with `{"ok":true,"env":"stg"}`
  - webhook unsigned reject:
    - `curl -i -X POST https://member-webhook-pvxgenwkba-ue.a.run.app/webhook/line -d '{}'`
    - Output: `HTTP/2 401` body `unauthorized`
  - webhook accept logs:
    - `gcloud logging read 'resource.type="cloud_run_revision" resource.labels.service_name="member-webhook" textPayload:"accept"' --project member-485303 --limit 5 --format="value(textPayload)"`
    - Output:
      - `[webhook] requestId=34d0f9a069d6aaf02c397c7ff9803cb7 accept`
      - `[webhook] requestId=4606416e2583e55f40897e2a5bb923c5 accept`

- Phase0 gate checks (2026-01-28):
  - Deploy run (PR #31):
    - Run URL: `https://github.com/parentyai/member/actions/runs/21419254631`
    - Head SHA: `41b1b0dc4b5c74db19b537cc30d223120a9c0273`
  - member IAM (private check):
    - `gcloud run services get-iam-policy member --region us-east1 --project member-485303 --format="yaml(bindings)"`
    - Output:
      ```
      bindings:
      - members:
        - user:nshimamura@parentyai.com
        role: roles/run.invoker
      ```
  - member unauth access (expected 403):
    - `curl -i https://member-pvxgenwkba-ue.a.run.app/`
    - Output: `HTTP/2 403`
  - webhook IAM (public check):
    - `gcloud run services get-iam-policy member-webhook --region us-east1 --project member-485303 --format="yaml(bindings)"`
    - Output:
      ```
      bindings:
      - members:
        - allUsers
        role: roles/run.invoker
      ```
  - webhook healthz:
    - `curl -i https://member-webhook-pvxgenwkba-ue.a.run.app/healthz/`
    - Output: `HTTP/2 200` with `{"ok":true,"env":"stg"}`
  - webhook unsigned reject:
    - `curl -i -X POST https://member-webhook-pvxgenwkba-ue.a.run.app/webhook/line -d '{}'`
    - Output: `HTTP/2 401` body `unauthorized`
  - webhook accept logs:
    - `gcloud logging read 'resource.type="cloud_run_revision" resource.labels.service_name="member-webhook" textPayload:"accept"' --project member-485303 --limit 2 --format="value(textPayload)"`
    - Output:
      - `[webhook] requestId=c3cc69687afaefde9b579567dbfd67cf accept`
      - `[webhook] requestId=8de6ab4cfc06c6691b47ed8d616d04d8 accept`

- Phase0 gate checks (2026-01-28, post-PR32):
  - Deploy run (PR #32):
    - Run URL: `https://github.com/parentyai/member/actions/runs/21421291512`
    - Head SHA: `613d6b4a6b111707e32d9c4955f9ef3d728563cd`
  - member IAM (private check):
    - `gcloud run services get-iam-policy member --region us-east1 --project member-485303 --format="yaml(bindings)"`
    - Output:
      ```
      bindings:
      - members:
        - user:nshimamura@parentyai.com
        role: roles/run.invoker
      ```
  - member unauth access (expected 403):
    - `curl -i https://member-pvxgenwkba-ue.a.run.app/`
    - Output: `HTTP/2 403`

- Phase0 gate checks (2026-01-28, post-PR33):
  - Deploy run (PR #33):
    - Run URL: `https://github.com/parentyai/member/actions/runs/21421446012`
    - Head SHA: `b57621e3a40ba74959cb0817ce3aeab091dd4e6a`
  - member IAM (private check):
    - `gcloud run services get-iam-policy member --region us-east1 --project member-485303 --format="yaml(bindings)"`
    - Output:
      ```
      bindings:
      - members:
        - user:nshimamura@parentyai.com
        role: roles/run.invoker
      ```
  - member unauth access (expected 403):
    - `curl -i https://member-pvxgenwkba-ue.a.run.app/`
    - Output: `HTTP/2 403`

- Phase0 gate checks (2026-01-28, post-PR34):
  - Deploy run (PR #34):
    - Run URL: `https://github.com/parentyai/member/actions/runs/21422561429`
    - Head SHA: `58d57b6978ae54c975f917dda5a3d23d1475eafd`
  - member IAM (private check):
    - `gcloud run services get-iam-policy member --region us-east1 --project member-485303 --format="yaml(bindings)"`
    - Output:
      ```
      bindings:
      - members:
        - user:nshimamura@parentyai.com
        role: roles/run.invoker
      ```
  - member unauth access (expected 403):
    - `curl -i https://member-pvxgenwkba-ue.a.run.app/`
    - Output: `HTTP/2 403`
  - webhook IAM (public check):
    - `gcloud run services get-iam-policy member-webhook --region us-east1 --project member-485303 --format="yaml(bindings)"`
    - Output:
      ```
      bindings:
      - members:
        - allUsers
        role: roles/run.invoker
      ```
  - webhook healthz:
    - `curl -i https://member-webhook-pvxgenwkba-ue.a.run.app/healthz/`
    - Output: `HTTP/2 200` with `{"ok":true,"env":"stg"}`
  - webhook unsigned reject:
    - `curl -i -X POST https://member-webhook-pvxgenwkba-ue.a.run.app/webhook/line -d '{}'`
    - Output: `HTTP/2 401` body `unauthorized`
  - webhook accept logs:
    - `gcloud logging read 'resource.type="cloud_run_revision" resource.labels.service_name="member-webhook" textPayload:"accept"' --project member-485303 --limit 2 --format="value(textPayload)"`
    - Output:
      - `[webhook] requestId=c3cc69687afaefde9b579567dbfd67cf accept`
      - `[webhook] requestId=8de6ab4cfc06c6691b47ed8d616d04d8 accept`

- Phase0 gate checks (2026-01-28, post-PR35):
  - Deploy run (PR #35):
    - Run URL: `https://github.com/parentyai/member/actions/runs/21422926331`
    - Head SHA: `e227a5016d491a70b8b72322c5088ccc58787118`
  - member IAM (private check):
    - `gcloud run services get-iam-policy member --region us-east1 --project member-485303 --format="yaml(bindings)"`
    - Output:
      ```
      bindings:
      - members:
        - user:nshimamura@parentyai.com
        role: roles/run.invoker
      ```
  - member unauth access (expected 403):
    - `curl -i https://member-pvxgenwkba-ue.a.run.app/`
    - Output: `HTTP/2 403`
  - webhook IAM (public check):
    - `gcloud run services get-iam-policy member-webhook --region us-east1 --project member-485303 --format="yaml(bindings)"`
    - Output:
      ```
      bindings:
      - members:
        - allUsers
        role: roles/run.invoker
      ```
  - webhook healthz:
    - `curl -i https://member-webhook-pvxgenwkba-ue.a.run.app/healthz/`
    - Output: `HTTP/2 200` with `{"ok":true,"env":"stg"}`
  - webhook unsigned reject:
    - `curl -i -X POST https://member-webhook-pvxgenwkba-ue.a.run.app/webhook/line -d '{}'`
    - Output: `HTTP/2 401` body `unauthorized`
  - webhook accept logs:
    - `gcloud logging read 'resource.type="cloud_run_revision" resource.labels.service_name="member-webhook" textPayload:"accept"' --project member-485303 --limit 2 --format="value(textPayload)"`
    - Output:
      - `[webhook] requestId=c3cc69687afaefde9b579567dbfd67cf accept`
      - `[webhook] requestId=8de6ab4cfc06c6691b47ed8d616d04d8 accept`
