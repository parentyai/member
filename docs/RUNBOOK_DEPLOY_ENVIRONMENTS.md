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
- `REDAC_MEMBERSHIP_ID_HMAC_SECRET`
- `OPS_CONFIRM_TOKEN_SECRET`

## Runtime Secret Access Guardrail
Deploy workflow は Cloud Run deploy 前に、runtime SA へ必要 Secret の
`roles/secretmanager.secretAccessor` を idempotent に付与する。

対象:
- `.github/workflows/deploy.yml`
- `.github/workflows/deploy-webhook.yml`
- `.github/workflows/deploy-track.yml`

前提:
- deploy SA（`GCP_DEPLOY_SA`）に Secret IAM ポリシー更新権限があると自動付与まで完了する
  - 例: `roles/secretmanager.admin`（または同等権限）
  - 権限がない場合は workflow で warning を出して継続する（Cloud Run deploy が最終判定）

## Workflow Preflight Guards
各 deploy workflow では build/deploy 前に以下を fail-fast で検証する。

1) required variables が空でないこと
- `deploy.yml`: `GCP_PROJECT_ID`, `GCP_REGION`, `SERVICE_NAME`, `GCP_WIF_PROVIDER`, `RUNTIME_SA_EMAIL`, `DEPLOY_SA_EMAIL`, `ENV_NAME`, `PUBLIC_BASE_URL`, `FIRESTORE_PROJECT_ID`, `STORAGE_BUCKET`
- `deploy-webhook.yml`: `GCP_PROJECT_ID`, `GCP_REGION`, `SERVICE_NAME`, `GCP_WIF_PROVIDER`, `RUNTIME_SA_EMAIL`, `DEPLOY_SA_EMAIL`, `ENV_NAME`, `FIRESTORE_PROJECT_ID`
- `deploy-track.yml`: `GCP_PROJECT_ID`, `GCP_REGION`, `SERVICE_NAME`, `GCP_WIF_PROVIDER`, `RUNTIME_SA_EMAIL`, `DEPLOY_SA_EMAIL`, `ENV_NAME`, `FIRESTORE_PROJECT_ID`

2) required secrets の preflight（存在確認と権限不足の切り分け）
- `deploy.yml`: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `ADMIN_OS_TOKEN`, `TRACK_TOKEN_SECRET`, `REDAC_MEMBERSHIP_ID_HMAC_SECRET`, `OPS_CONFIRM_TOKEN_SECRET`
- `deploy-webhook.yml`: `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`, `REDAC_MEMBERSHIP_ID_HMAC_SECRET`
- `deploy-track.yml`: `TRACK_TOKEN_SECRET`

意図:
- 不足設定を Cloud Build 実行前に検知する
- `NOT_FOUND` は `Missing Secret Manager secret` として fail-fast
- deploy SA で metadata が見えない場合は `Secret visibility skipped` として warning/notice を出し、
  deploy/runtime 側の判定へ進める（permission不足とmissingを分離）

運用メモ:
- deploy SA が Secret metadata を参照できるようにする場合は、最小権限として
  `roles/secretmanager.viewer`（または同等）を付与する。
- 参照権限がない運用でも、`NOT_FOUND` の fail-fast が必要な場合は、
  別の高権限 principal で手動 preflight を実行する。

## OIDC / WIF Guardrail（workflow_dispatch 対応）
`workflow_dispatch(target_environment=prod)` で OIDC が `unauthorized_client` になる場合は、
Workload Identity Provider の `attributeCondition` が `push(main)` のみ許可している可能性が高い。

推奨条件（例）:
- `assertion.repository=='parentyai/member' && (assertion.ref=='refs/heads/main' || assertion.event_name=='workflow_dispatch')`

確認:
- `gcloud iam workload-identity-pools providers describe github-provider --location=global --workload-identity-pool=github-pool --project=<PROJECT_NUMBER_OR_ID> --format='value(attributeCondition)'`

更新（必要時のみ）:
- `gcloud iam workload-identity-pools providers update-oidc github-provider --location=global --workload-identity-pool=github-pool --project=<PROJECT_NUMBER_OR_ID> --attribute-condition=\"assertion.repository=='parentyai/member' && (assertion.ref=='refs/heads/main' || assertion.event_name=='workflow_dispatch')\"`

注意:
- provider 条件はセキュリティ境界。repository 条件は維持すること。
- 変更後は `push(main)` と `workflow_dispatch(prod)` の両方を検証すること。

直近検証（2026-02-11, stg）:
- 実行コマンド:
  - `gh workflow run deploy.yml --ref main -f target_environment=stg`
- 実行結果:
  - https://github.com/parentyai/member/actions/runs/21927805235
  - `Auth (OIDC)` 成功、`deploy` まで成功
- 参考:
  - WIF provider condition（確認値）
  - `assertion.repository=='parentyai/member' && (assertion.ref=='refs/heads/main' || assertion.event_name=='workflow_dispatch')`

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
- Additional guard: `confirm_production=DEPLOY_PROD` を明示入力
- Job environment: `prod`
- 期待:
  - `dry-run` success
  - 承認後に `deploy*` 実行
  - stg 環境へ影響しない

実行例:
- `gh workflow run deploy.yml --ref main -f target_environment=prod -f confirm_production=DEPLOY_PROD`

## Verification
1) Actions run:
   - event と input を確認（`workflow_dispatch`, `target_environment=prod`）
   - OIDC step が成功していること（`Auth (OIDC)`）
2) Cloud Run:
   - `gcloud run services describe ... --format='value(spec.template.spec.containers[0].image)'`
3) Runtime SA:
   - `gcloud run services describe ... --format='value(spec.template.spec.serviceAccountName)'`
4) 環境分離:
   - `push(main)` 実行で `environment=stg` のみ更新されること
   - `prod` は `workflow_dispatch` + 承認なしに進まないこと

## Rollback
- 直近 deploy commit を revert
- 問題が設定由来の場合は Environment Variables/Secrets を直前値に戻して再デプロイ
