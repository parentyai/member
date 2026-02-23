# LAUNCH_CHECKLIST

## Purpose
本番ローンチ前に「壊れず、止められ、追える」状態を最終確認するチェックリスト。
（LINE-only / SSOT / traceId / Kill Switch 前提）

## Environment
### Required (Cloud Run / GitHub Actions)
- `ENV_NAME`
- `PUBLIC_BASE_URL`
- `FIRESTORE_PROJECT_ID`
- `STORAGE_BUCKET`
- `LINE_CHANNEL_SECRET`（secret）
- `LINE_CHANNEL_ACCESS_TOKEN`（secret）
- `OPS_CONFIRM_TOKEN_SECRET`（secret: confirmToken 用 / kill switch・composer・segment send・retry queue）

### Track / Click
- `TRACK_TOKEN_SECRET`（HMAC secret）
- `TRACK_BASE_URL`（段階導入の場合のみ）

## Webhook / Endpoints
- Webhook URL が正しい（`POST /webhook/line`）
- `GET /healthz` が 200 を返す
- 公開サービスが意図した SERVICE_MODE で動いている（webhook-only/track-onlyの境界が崩れていない）

## Kill Switch
- 現在値（ON/OFF）を確認できる
- ローンチ手順に従い、必要なら最初は ON のまま検証する
- 送信を伴う運用を開始する前に、必ず Kill Switch を再確認する

## Ops UX / Traceability
- `/admin/ops` が表示できる
- Ops Console 詳細に `traceId / riskLevel / lastReactionAt / stopReason` が表示される
- Trace Search で `traceId` を入力すると `audit_logs / decision_logs / decision_timeline` が取得できる

## Product Readiness (GO / NO_GO)
- `GET /api/admin/product-readiness` が 200 を返し、`status` と `blockers[]` を返却する
- `status=NO_GO` の場合、`blockers` が運用上の停止理由として説明可能
- `status=GO` の場合、`load_risk` / snapshot stale / fallback spike の閾値を満たしている
- `checks.retentionRisk.ok=true` であること（`retention_risk_generated_at_stale` / `retention_risk_*_over_budget` が出ていない）
- `checks.retentionRisk.generatedAtHours` が `docs/RETENTION_BUDGETS.md` の `retention_risk_freshness_max_hours` 以内であること
- `checks.structureRisk.ok=true` であること（`structure_risk_generated_at_stale` / `structure_risk_*_over_budget` が出ていない）
- `checks.structureRisk.generatedAtHours` が `docs/STRUCTURE_BUDGETS.md` の `structure_risk_freshness_max_hours` 以内であること

## Smoke (No Side Effects)
- `npm test` が PASS
- `npm run test:trace-smoke` が PASS（副作用ゼロ）
- `npm run test:ops-smoke` が PASS（Kill Switch guarded）

## Rollback
- revert 対象PR番号を確認（実装PR / docs PR）
- 緊急停止: Kill Switch を ON（運用手順に従う）
