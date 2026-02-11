# RUNBOOK_DEPLOY_ENVIRONMENTS

`stg` と `prod` のデプロイ経路を分離し、誤デプロイを防ぐための運用手順。

## Scope
- 対象 workflow:
  - `.github/workflows/deploy.yml`
  - `.github/workflows/deploy-webhook.yml`
  - `.github/workflows/deploy-track.yml`
- 方針:
  - `push(main)` は `stg` 環境へ自動デプロイ
  - `prod` は `workflow_dispatch` でのみ実行
  - `prod` は GitHub Environment の手動承認を必須化

## GitHub Environments
1) `stg` と `prod` の Environment を作成する。
2) `prod` には Required reviewers を設定する。
3) 各 Environment に以下の Variables/Secrets を分離して登録する。

Variables（例）:
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `SERVICE_NAME`
- `GCP_WIF_PROVIDER`
- `RUNTIME_SA_EMAIL`
- `GCP_DEPLOY_SA`
- `ENV_NAME`
- `PUBLIC_BASE_URL`（member のみ）
- `FIRESTORE_PROJECT_ID`
- `STORAGE_BUCKET`（member のみ）

Secrets（例）:
- `LINE_CHANNEL_SECRET`
- `LINE_CHANNEL_ACCESS_TOKEN`
- `ADMIN_OS_TOKEN`
- `TRACK_TOKEN_SECRET`
- `RIDAC_MEMBERSHIP_ID_HMAC_SECRET`
- `OPS_CONFIRM_TOKEN_SECRET`

## Deploy Paths
### stg
- Trigger: `push` to `main`
- Job environment: `stg`
- 期待:
  - `dry-run` success
  - `deploy*` success
  - Cloud Run image tag が merge SHA に追随

### prod
- Trigger: `workflow_dispatch` with `target_environment=prod`
- Job environment: `prod`
- 期待:
  - `dry-run` success
  - 承認後に `deploy*` 実行
  - stg 環境へ影響しない

## Verification
1) Actions run:
   - event と input を確認（`workflow_dispatch`, `target_environment=prod`）
2) Cloud Run:
   - `gcloud run services describe ... --format='value(spec.template.spec.containers[0].image)'`
3) Runtime SA:
   - `gcloud run services describe ... --format='value(spec.template.spec.serviceAccountName)'`

## Rollback
- 直近 deploy commit を revert
- 問題が設定由来の場合は Environment Variables/Secrets を直前値に戻して再デプロイ
