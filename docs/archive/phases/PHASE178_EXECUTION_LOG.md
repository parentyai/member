# PHASE178_EXECUTION_LOG

UTC: 2026-02-12T11:30:04Z
branch: `codex/phasec-c12-deploy-secret-access`
base: `origin/main` @ `57e38f5dd759`

## Track Mapping
- Execution log number: `PHASE178`（全体通番）
- Product track: `Phase C-1`（deploy 安定化 / 権限ドリフト耐性）
- 通番とプロダクトフェーズは別軸で管理する。

## Background
- main push（PR #371 merge）で deploy が失敗:
  - `Deploy to Cloud Run`: https://github.com/parentyai/member/actions/runs/21944529014
  - `Deploy webhook service`: https://github.com/parentyai/member/actions/runs/21944529002
- 共通エラー:
  - runtime SA `member-runtime@member-485303.iam.gserviceaccount.com` が
    `REDAC_MEMBERSHIP_ID_HMAC_SECRET` への `roles/secretmanager.secretAccessor` を持たず、
    Cloud Run revision 作成で `Permission denied on secret`。

## Scope
- deploy workflow で runtime SA への secret accessor を deploy 前に idempotent 付与。
- deploy runbook に guardrail と前提権限を追記。
- workflow 回帰テストを追加。

## Code Changes
- `.github/workflows/deploy.yml`
  - `Ensure runtime SA can access required secrets` step を追加
  - 対象 secret:
    - `LINE_CHANNEL_SECRET`
    - `LINE_CHANNEL_ACCESS_TOKEN`
    - `ADMIN_OS_TOKEN`
    - `TRACK_TOKEN_SECRET`
    - `REDAC_MEMBERSHIP_ID_HMAC_SECRET`
    - `OPS_CONFIRM_TOKEN_SECRET`
- `.github/workflows/deploy-webhook.yml`
  - 同 step を追加
  - 対象 secret:
    - `LINE_CHANNEL_SECRET`
    - `LINE_CHANNEL_ACCESS_TOKEN`
    - `REDAC_MEMBERSHIP_ID_HMAC_SECRET`
- `.github/workflows/deploy-track.yml`
  - 同 step を追加
  - 対象 secret:
    - `TRACK_TOKEN_SECRET`
- `docs/RUNBOOK_DEPLOY_ENVIRONMENTS.md`
  - Runtime Secret Access Guardrail を追記（deploy SA 前提権限）
- `tests/phase178/phase178_workflow_runtime_secret_access.test.js`
  - 3 workflow に guard step が存在することを検証

## Local Verification
- `node --test tests/phase178/phase178_workflow_runtime_secret_access.test.js` PASS
- `npm test` PASS (`485/485`)
- `npm run test:trace-smoke` PASS
- `npm run test:ops-smoke` PASS

## Rollback
- PR を revert し、workflow から secret IAM 自動付与 step を削除して従来運用へ戻す。
