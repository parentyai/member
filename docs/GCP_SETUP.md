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

GITHUB_OWNER=parentyai
GITHUB_REPO=member
GITHUB_BRANCH=main

WIF_POOL=github-pool
WIF_PROVIDER=github-provider
WIF_PRINCIPAL="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_OWNER}/${GITHUB_REPO}"

DEPLOY_SA_EMAIL="member-deploy@${PROJECT_ID}.iam.gserviceaccount.com"
RUNTIME_SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
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

## 5) Secret Manager (required for LINE credentials)

```sh
gcloud secrets create LINE_CHANNEL_SECRET --project "$PROJECT_ID"

gcloud secrets create LINE_CHANNEL_ACCESS_TOKEN --project "$PROJECT_ID"
```

Expected:
- `gcloud secrets list` shows both secrets.

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
  - Commit: `993fbde`
  - Dry-run: `https://github.com/parentyai/member/actions/runs/21344251953` (green)
