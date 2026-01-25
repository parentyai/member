# GitHub Setup (Phase0)

Linked Task: P0-020, P0-120

## Repository
- Remote: git@github.com:parentyai/member.git

## Branch Model
- main: protected, stable
- phase0/setup: scaffolding PR
- phase0/impl-p0-###-*: implementation PRs

## Branch Protection (main)
1) Go to Settings -> Branches.
2) Add branch protection rule.
3) Branch name pattern: main
4) Require a pull request before merging: ON
5) Require status checks to pass before merging: ON
   - Required check name: `dry-run` (set after the workflow runs once)
6) Do not allow bypassing the above settings: ON
7) Block force pushes: ON
8) Do not allow deletions: ON
9) Save changes.

Expected:
- PRs show `dry-run` as a required check.

## PR Workflow
1) Create a branch from main.
2) Make minimal changes for a single P0 task.
3) Run `npm test` locally.
4) Fill `.github/PULL_REQUEST_TEMPLATE.md`.
5) Open PR and merge after review.

## GitHub Actions (OIDC)
- Repository variables (non-secret):
  - `GCP_PROJECT_ID`
  - `GCP_REGION`
  - `SERVICE_NAME`
  - `RUNTIME_SA_EMAIL`
  - `ENV_NAME`
  - `PUBLIC_BASE_URL`
  - `FIRESTORE_PROJECT_ID`
  - `STORAGE_BUCKET`
  - `GCP_WIF_PROVIDER`
  - `GCP_DEPLOY_SA`
- No GitHub Secrets required for auth (OIDC + SA impersonation).
- Deploy workflow: `.github/workflows/deploy.yml`

Expected:
- On PR: `dry-run` job runs.
- On merge to main: `deploy` job runs.

## Notes
- Do not push directly to main.
- SSOT changes must be logged in `docs/SSOT_DELTA_PROPOSAL.md`.
