# RUNBOOK_STG_NOTIFICATION_E2E_CHECKLIST

stg 実測を毎回同じ順番で実施し、traceId で証跡化するための固定チェックリスト。

## Preconditions
- `gcloud auth login` 済み
- `member-485303 / us-east1` へのアクセス権
- Admin token が取得できること（Secret Manager 管理）

## Recommended Command (automated)
固定順チェックは以下コマンドで一括実行する。

```bash
npm run ops:stg-e2e -- \
  --base-url http://127.0.0.1:18080 \
  --admin-token "$ADMIN_OS_TOKEN" \
  --actor ops_stg_e2e \
  --fetch-route-errors \
  --fail-on-route-errors \
  --fail-on-missing-audit-actions \
  --trace-limit 100 \
  --project-id member-485303 \
  --md-out docs/PHASE_C_STG_E2E_$(date +%F).md
```

- 出力(JSON): `artifacts/stg-notification-e2e/stg-notification-e2e-*.json`
- `--allow-skip` を付けない場合、`SKIP` を失敗扱いにする（precondition漏れを検知）
- 既定で automation mode が `EXECUTE` でない場合は一時的に切替えて終了時に復元する
- Kill Switch と system config（quietHours）はシナリオ内で一時変更し、終了時に復元する

## Recommended Command (GitHub Actions)
ローカル実行が難しい場合は workflow_dispatch で同じ固定順チェックを実行する。

```bash
gh workflow run stg-notification-e2e.yml --ref main \
  -f actor=ops_stg_e2e \
  -f route_error_limit=20 \
  -f trace_limit=100 \
  -f fail_on_missing_audit_actions=true
```

- 実行 workflow: `.github/workflows/stg-notification-e2e.yml`
- 実行環境: `stg`
- 収集物: `stg-notification-e2e-<run_id>` artifact（JSON/Markdown）

### Required Inputs
- `ADMIN_OS_TOKEN`: 管理APIトークン

### Optional Inputs
- `segment-template-key`: Segment plan/dry-run/execute 用テンプレートキー（未指定時は `status=active` を自動解決）
- `composer-notification-id`: Composer cap block 検証対象 notificationId（未指定時は active 一覧から `send/plan` 可能な候補を自動解決）
- `retry-queue-id`: 未指定時は pending queue を自動検出（見つからなければ `SKIP`）
- `segment-template-version`: 固定バージョン指定が必要な場合のみ
- `segment-query-json`: Segment フィルタを明示したい場合のみ
- `fetch-route-errors + project-id`: FAIL時に Cloud Logging の `[route_error]` を traceId で回収
- `fail-on-route-errors`: route_error が1件でも出たシナリオを FAIL 扱いにする（`fetch-route-errors` を暗黙有効化）
- `trace_limit`: trace bundle 取得件数（`/api/admin/trace?limit`）を 1-500 で指定
- `fail_on_missing_audit_actions`: シナリオごとの必須 audit action 欠落を FAIL 扱いにする（推奨 true）

## Checklist (fixed order)
1. Product Readiness Gate（管理API 6本）:
   - `/api/admin/product-readiness` が `status=GO` かつ `checks.retentionRisk.ok=true` / `checks.structureRisk.ok=true` / `checks.structureRisk.activeLegacyRepoImports=0`
   - `/api/admin/read-path-fallback-summary` が HTTP 200
   - `/api/admin/retention-runs` が HTTP 200
   - `/api/admin/struct-drift/backfill-runs` が HTTP 200
   - `/api/admin/os/alerts/summary` が HTTP 200
   - `/api/admin/city-packs` が HTTP 200
2. Segment Send: `plan -> dry-run -> execute`
3. Retry Queue: `plan -> retry`
4. Kill Switch: ON時に send 系が全ブロックされる
5. Composer execute: cap 到達ユーザーが `notification_cap_blocked`

## Run Cadence
- 推奨: main への通知制御系マージごとに 1 回 + 週次 1 回
- 実施者: Ops 担当（`x-actor` は固定値を使う）
- 失敗時: その時点で中断し、`docs/PHASE*_EXECUTION_LOG.md` に fail を残す

## Execution Log Rule (fixed)
- 証跡の記録先は次のいずれかに統一する:
  - 既存ログ追記: `docs/archive/phases/PHASE170_EXECUTION_LOG.md`
  - 新規ログ作成: `docs/archive/phases/PHASE_C_STG_E2E_YYYY-MM-DD.md`
- 各実行ごとに必須で残す:
  - `UTC`（ISO8601）
  - `main SHA`（`git rev-parse origin/main`）
  - `service image tag`（member / member-webhook / member-track）
  - `traceId` / `requestId`
  - `expected` / `actual` / `result`

## TraceId Naming (recommended)
- Segment plan/dry-run/execute: `trace-stg-segment-<UTC compact>`
- Product readiness gate: `trace-stg-product-readiness-gate-<UTC compact>`
- Retry plan/retry: `trace-stg-retry-<UTC compact>`
- Kill switch block: `trace-stg-killswitch-<UTC compact>`
- Composer cap block: `trace-stg-composer-cap-<UTC compact>`
- 形式を固定し、操作単位で trace を分ける（bundle の混線を防ぐ）

## Evidence Capture
- 各操作で `x-trace-id` を固定して送る
- `GET /api/admin/trace?traceId=<id>&limit=50` で bundle を回収
- `docs/archive/phases/PHASE170_EXECUTION_LOG.md` へ以下を追記:
  - traceId
  - requestId
  - expected
  - actual
  - pass/fail

### Evidence Quality Gate（記録時のチェック）
- `audit_actions` に `plan` と `execute` の両方が含まれること
- strict mode（`--fail-on-missing-audit-actions`）では必須 action 欠落時に自動 FAIL になる
- `result=FAIL` の場合、再実施条件（何を直して再試行するか）を `notes` に書く
- 個人情報（平文会員ID、token、secret）は書かない
- URL証跡（Actions run / Cloud Run revision / trace API）を可能な限り添付する

### Evidence Template（copy）
```
date: YYYY-MM-DD
env: stg
actor: <x-actor>
scenario: <segment_execute|retry|kill_switch|composer_cap>
traceId: <trace-id>
requestId: <request-id or unknown>
expected: <expected outcome>
actual: <actual outcome>
audit_actions: <comma separated actions>
decision_ids: <comma separated ids or ->
timeline_ids: <comma separated ids or ->
result: <PASS|FAIL>
notes: <optional>
```

### Full Log Template
- テンプレートファイルを使って記録を開始:
  - `docs/EXECUTION_LOG_TEMPLATE_STG_NOTIFICATION.md`

## Acceptance
- `audits/decisions/timeline` が欠損しない
- ブロック理由が `notification_policy_blocked` または `notification_cap_blocked` で一貫
- 個人情報（平文ID）は証跡に残さない
- 5シナリオすべての `result` が記録されている（PASS/FAIL問わず）

## Latest Mainline Evidence (W7)
- date: `2026-02-23`
- workflow run: `22319659529` (`main`, success)
- fixed-order summary: `pass=5 fail=0 skip=0`
- scenario results:
  - `product_readiness_gate: PASS`
  - `segment: PASS`
  - `retry_queue: PASS`
  - `kill_switch_block: PASS`
  - `composer_cap_block: PASS`
- note:
  - prior run `22319585228` failed with `product_readiness_no_go:snapshot_stale_ratio_high`
  - rerun succeeded after snapshot freshness recovery (`status=GO`)
