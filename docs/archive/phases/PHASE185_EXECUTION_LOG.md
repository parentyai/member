# PHASE185_EXECUTION_LOG

UTC: 2026-02-13T00:00:00Z
branch: `main`
base: `origin/main` @ `743c0d0`

## Track Mapping
- Execution log number: `PHASE185`（全体通番）
- Product track: `Phase C-1`（deploy復旧: secret preflight 判定改善）
- 通番とプロダクトフェーズは別軸で管理する。

## Scope
- deploy workflow の secret preflight を「missing」と「permission不足」に分離。
- preflight が permission不足で false-fail し、main→stg 反映が止まる事象を回避。
- Runbook に新しい preflight 判定方針を反映。

## Code Changes
- `.github/workflows/deploy.yml`
  - `Validate required secrets exist` を更新:
    - `NOT_FOUND` は fail-fast（`Missing Secret Manager secret`）
    - `PERMISSION_DENIED` / `secretmanager.secrets.get` は warning + notice で継続
- `.github/workflows/deploy-webhook.yml`
  - 同上（missing と permission不足を分離）
- `.github/workflows/deploy-track.yml`
  - 同上（single secret check でも同じ分岐を適用）
- `docs/RUNBOOK_DEPLOY_ENVIRONMENTS.md`
  - preflight判定の仕様（missing=FAIL / permission不足=WARN）を明文化
- `tests/phase185/phase185_workflow_secret_preflight_visibility_split.test.js`（新規）
  - 3 workflow の分岐実装（NOT_FOUND / permission warning / notice）を静的検証

## Local Verification
- `node --test tests/phase185/phase185_workflow_secret_preflight_visibility_split.test.js` PASS
- `npm test` PASS

## Rollback
- 本PRを revert し、3 workflow の secret preflight を直前実装に戻す。
- `docs/RUNBOOK_DEPLOY_ENVIRONMENTS.md` と `tests/phase185/*` を同時に巻き戻す。
