# PHASE170_EXECUTION_LOG

UTC: 2026-02-11T13:18:16Z
branch: `codex/opsos-bc-phaseB`
local HEAD: `e0350964c55a86b3a454fad0660e92b207fd4f5a`

## Scope
- Phase C post-hardening:
  - notification caps extended (`daily/category/quietHours`)
  - System Config plan/set payload extension + impact preview
  - Delivery recovery recommendation surface
  - LINE会員ID UX文言の改善
  - deploy workflow の stg/prod 分離（`workflow_dispatch + target_environment`）

## Local Verification
- `npm run preflight`: PASS
- `npm test`: PASS (`tests 455 / fail 0`)
- `npm run test:trace-smoke`: PASS
- `npm run test:ops-smoke`: PASS

## CI Evidence (main)
- `Deploy to Cloud Run`: success
  - https://github.com/parentyai/member/actions/runs/21889358431
- `Deploy webhook service (Cloud Run)`: success
  - https://github.com/parentyai/member/actions/runs/21889358424
- `Deploy track service (Cloud Run)`: success
  - https://github.com/parentyai/member/actions/runs/21889358432
- `Audit Gate`: success
  - https://github.com/parentyai/member/actions/runs/21889358425

## stg Runtime Verification (updated: 2026-02-11T14:21:19Z)
- gcloud auth:
  - active account: `nshimamura@parentyai.com`
  - project: `member-485303`
- Cloud Run (`us-east1`) latest ready:
  - `member`: `member-00358-d5t` / `member:2ab0386af4cb1d9d576468c3c09222d00bd071ea`
  - `member-webhook`: `member-webhook-00020-ls9` / `member-webhook:2ab0386af4cb1d9d576468c3c09222d00bd071ea`
  - `member-track`: `member-track-00183-8tz` / `member-track:2ab0386af4cb1d9d576468c3c09222d00bd071ea`
  - runtime SA (all): `member-runtime@member-485303.iam.gserviceaccount.com`
- Health checks:
  - `member-webhook /healthz/`: `200`
  - `member-track /healthz/`: `200`
  - `member /healthz/`: `403`（private serviceとして期待どおり）

## stg E2E / Trace Evidence
- Segment send (`plan -> dry-run -> execute`)
  - traceId: `trace-segment-e2e-1770819340`
  - `POST /api/phase67/send/plan`: `500`
  - `POST /api/phase81/segment-send/dry-run`: `500`
  - trace bundle: `audits=0 / decisions=0 / timeline=0`
  - 判定: **未完了（stg runtime blocker）**
- Retry queue (`plan -> retry`)
  - traceId: `trace-retry-e2e-1770819567`
  - `POST /api/phase73/retry-queue/plan`: `200`
  - `POST /api/phase73/retry-queue/retry`: `ok=false, reason=send_failed, error=\"LINE API error: 400\"`
  - trace bundle: actions `retry_queue.plan`, `retry_queue.execute`
- Kill Switch block (send系ブロック実測)
  - traceId: `trace-retry-kill-block-1770819567`
  - `kill_switch ON` 後の `POST /api/phase73/retry-queue/retry`: `ok=false, reason=kill_switch_on`
  - `kill_switch OFF` まで復帰確認済み
  - trace bundle: actions `kill_switch.plan/set`, `retry_queue.plan/execute`
- Notification cap block (quietHours)
  - traceId: `trace-cap-block-retry-1770819608`
  - `system_config` で `quietHours(UTC 13-15)` を plan/set
  - `POST /api/phase73/retry-queue/retry`: `ok=false, reason=notification_cap_blocked, capType=QUIET_HOURS`
  - `system_config` は null baseline に復元済み
  - trace bundle: actions `system_config.plan/set`, `retry_queue.plan/execute`
- Composer send
  - draft/approve traceId: `trace-composer-kill-1770819491`（`notifications.create/approve` は成功）
  - send plan traceId: `trace-killswitch-block-1770819513`
  - `POST /api/admin/os/notifications/send/plan`: `500`
  - 判定: **未完了（stg runtime blocker）**

## Current Blockers (stg runtime)
1. `GET /api/phase61/templates?status=active` が `500`（`?limit=20` は `200`）
2. `GET /api/phase66/segments/send-targets` が `500`
3. `POST /api/phase67/send/plan` / `POST /api/phase81/segment-send/dry-run` が `500`
4. `GET /api/phase73/retry-queue?limit=10` が `500`（`queueId` 指定の plan/retry は実行可）
5. `POST /api/admin/os/notifications/send/plan` が `500`

備考:
- requestログでHTTPステータスは確認済み（`gcloud logging read ... run.googleapis.com/requests`）。
- アプリ側が例外を `{"ok":false,"error":"error"}` に丸めるため、根本原因の特定には server-side での構造化エラーログ追加が必要。

## Follow-up Fix Verification (2026-02-11T16:01Z)
- branch fix commit: `06c3a5e6ae2e8350edd40542c4f0aabc58f7f669`
- PR: https://github.com/parentyai/member/pull/356
- manual deploy note:
  - GitHub `workflow_dispatch` run `21912379573` failed at OIDC auth with:
    - `unauthorized_client: The given credential is rejected by the attribute condition.`
  - stg verification was executed by manual `gcloud builds submit` + `gcloud run deploy member` using image:
    - `member:06c3a5e6ae2e8350edd40542c4f0aabc58f7f669`
    - latest ready revision after deploy: `member-00359-28k`

### Re-test Results (same endpoints that previously failed)
- `GET /api/phase61/templates?status=active&limit=5`: `200` (fixed)
- `GET /api/phase73/retry-queue?limit=10`: `200` (fixed)
- `GET /api/phase66/segments/send-targets?limit=5`: `200` (fixed)
- `GET /api/phase25/ops/console?lineUserId=U_TEST_RIDAC_A_20260210092935`: `200` (fixed)
- `POST /api/phase67/send/plan`: `200` (fixed)
- `POST /api/phase81/segment-send/dry-run`: `200` (fixed)
- `POST /api/admin/os/notifications/send/plan`: `200` (fixed)

### Trace/Evidence IDs
- `trace-fix-segment_plan-1770825681`
- `trace-fix-segment_dry-1770825681`
- `trace-fix-composer_plan-1770825681`
- response payloads saved under `/tmp/member-e2e/fix_*.json` during verification

## workflow_dispatch OIDC Re-Verification (2026-02-11T23:56:51Z)
- Run:
  - `Deploy to Cloud Run` (workflow_dispatch, target_environment=stg)
  - https://github.com/parentyai/member/actions/runs/21927805235
- Result:
  - `dry-run`: success
  - `deploy`: success
  - `Auth (OIDC)`: success（`unauthorized_client` の再発なし）
- stg latest ready revisions after run:
  - `member`: `member-00364-6jz` / `member:967f73bf914bb8369704f2e77be592e89fd337f2` / traffic `100`
  - `member-webhook`: `member-webhook-00023-866` / `member-webhook:967f73bf914bb8369704f2e77be592e89fd337f2` / traffic `100`
  - `member-track`: `member-track-00186-rt4` / `member-track:967f73bf914bb8369704f2e77be592e89fd337f2` / traffic `100`
- 判定:
  - Phase C-1 の `workflow_dispatch` 経路（OIDC）は stg で実測成功。
