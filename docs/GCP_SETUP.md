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
PROJECT_ID=YOUR_PROJECT_ID
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
REGION=us-east1
SERVICE_NAME=member-api

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

## 6) GitHub Repository Settings
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

## 7) Dry-Run Checklist (must pass before deploy)
- [ ] Required APIs enabled
- [ ] WIF provider resource name recorded in `GCP_WIF_PROVIDER`
- [ ] WIF binding to deploy SA applied
- [ ] Deploy SA + runtime SA roles applied
- [ ] Secrets exist in Secret Manager
- [ ] PR dry-run job passes (lint/tests)
- [ ] Service URL reachable after deploy
- [ ] Logs visible in Cloud Run / Cloud Logging
- [ ] Firestore read/write verified with runtime SA

