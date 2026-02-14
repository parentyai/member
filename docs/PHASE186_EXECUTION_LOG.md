# PHASE186_EXECUTION_LOG

UTC: 2026-02-13T01:20:00Z
branch: `main`
base: `origin/main` @ `6183f81`

## Track Mapping
- Execution log number: `PHASE186`（全体通番）
- Product track: `Phase C-2`（stg E2E 実測経路の安定化）
- 通番とプロダクトフェーズは別軸で管理する。

## Incident
- stg notification e2e workflow (`stg-notification-e2e.yml`) が
  `Validate required secret exists` で FAIL。
- 原因: deploy SA で `ADMIN_OS_TOKEN` の metadata が見えず、
  `missing or inaccessible` と誤判定されていた。
- 該当 run: `21970798387`（workflow_dispatch）

## Follow-up Run
- `Validate required secret exists` は通過したが、
  `Read ADMIN_OS_TOKEN from Secret Manager` で FAIL。
- 原因: deploy SA が `ADMIN_OS_TOKEN` の version access 権限を持たない。
- 該当 run: `21971156805`（workflow_dispatch）

## Follow-up Run 2
- `Resolve ADMIN_OS_TOKEN` で FAIL。
- 原因: GitHub Secrets の `ADMIN_OS_TOKEN` が空で、
  Secret Manager read にフォールバック → deploy SA が `secretmanager.versions.access` を持たず失敗。
- 該当 run: `21971258314`（workflow_dispatch）

## Follow-up Run 3
- `Run stg notification e2e checklist` で FAIL。
- 原因: Cloud Run IAM (member) が private のため、
  `gcloud run services proxy` が認証されず 403 → automation-config 取得が 500 で失敗。
- 該当 run: `21971825701`（workflow_dispatch）

## Follow-up Run 4
- deploy SA に `roles/run.invoker` を付与したが、
  `gcloud run services proxy` が IAM 認証に失敗し続けた。
- 原因: proxy が identity token を明示的に付与していなかったため。
- 該当 run: `21971875763`（workflow_dispatch）

## Follow-up Run 5
- `gcloud auth print-identity-token --audiences` が失敗。
- 原因: access token 認証のため、audiences 付きの identity token を mint できなかった。
- 該当 run: `21972657933`（workflow_dispatch）

## Follow-up Run 6
- E2E 実行は `segment` が FAIL、他は PASS。
- 原因: Segment execute で LINE API 400 が発生し、全件失敗（executedCount=0）。
- 該当 run: `21973137031`（workflow_dispatch）
- Trace:
  - segment: `trace-stg-e2e-segment-20260213031003`
  - retry_queue: `trace-stg-e2e-retry-queue-20260213031011`
  - kill_switch_block: `trace-stg-e2e-kill-switch-block-20260213031013`
  - composer_cap_block: `trace-stg-e2e-composer-cap-block-20260213031014`

## Follow-up Run 7-8
- `Run stg notification e2e checklist` で FAIL。
- 原因: `segment_query_json` の入力が GitHub Actions の input 経由で
  `--segment-query-json {lineUserIds:[...]}` の形式になり、JSON parse が失敗。
- 該当 run:
  - `21991156730`（workflow_dispatch）
  - `21991216858`（workflow_dispatch）

## Follow-up Run 9
- `segment` と `composer_cap_block` が FAIL。
- 原因:
  - segment: `segment_execute_not_ok:unknown`（送信失敗で ok=false, reason未設定）
  - composer_cap_block: `notification not active`（指定 notificationId が非active）
- 該当 run: `21991317682`（workflow_dispatch / ref=codex/phasec-c27-stg-e2e-segment-target）
- Trace:
  - segment: `trace-stg-e2e-segment-20260213145536`
  - retry_queue: `trace-stg-e2e-retry-queue-20260213145545`
  - kill_switch_block: `trace-stg-e2e-kill-switch-block-20260213145546`
  - composer_cap_block: `trace-stg-e2e-composer-cap-block-20260213145548`

## Follow-up Run 10
- `segment` が FAIL、他は PASS。
- 原因:
  - segment: `segment_execute_not_ok:unknown`（送信失敗で ok=false, reason未設定）
- 該当 run: `22009474454`（workflow_dispatch / ref=codex/phasec-c27-stg-e2e-segment-target）
- Trace:
  - segment: `trace-stg-e2e-segment-20260214022723`
  - retry_queue: `trace-stg-e2e-retry-queue-20260214022726`
  - kill_switch_block: `trace-stg-e2e-kill-switch-block-20260214022728`
  - composer_cap_block: `trace-stg-e2e-composer-cap-block-20260214022730`

## Follow-up Run 11
- `segment` が FAIL、他は PASS。
- 原因:
  - segment: Firestore write で `deliveredAt` が undefined になり失敗。
  - 失敗詳細: `Value for argument "data" is not a valid Firestore document. Cannot use "undefined" as a Firestore value (found in field "deliveredAt").`
- 該当 run: `22009651714`（workflow_dispatch / ref=codex/phasec-c27-stg-e2e-segment-target）
- Trace:
  - segment: `trace-stg-e2e-segment-20260214024016`
  - retry_queue: `trace-stg-e2e-retry-queue-20260214024020`
  - kill_switch_block: `trace-stg-e2e-kill-switch-block-20260214024022`
  - composer_cap_block: `trace-stg-e2e-composer-cap-block-20260214024025`

## Follow-up Run 12
- `segment` / `retry_queue` / `kill_switch_block` / `composer_cap_block` 全て PASS。
- 該当 run: `22010373031`（workflow_dispatch / ref=main）
- headSha: `f22ba33660a7c16c30bb6973bd4dd5be17af4d39`
- Trace:
  - segment: `trace-stg-e2e-segment-20260214033412`
  - retry_queue: `trace-stg-e2e-retry-queue-20260214033417`
  - kill_switch_block: `trace-stg-e2e-kill-switch-block-20260214033419`
  - composer_cap_block: `trace-stg-e2e-composer-cap-block-20260214033423`

## Follow-up Run 13
- `segment` / `composer_cap_block` が FAIL、`retry_queue` / `kill_switch_block` は PASS。
- 該当 run: `22018905090`（workflow_dispatch / ref=main）
- headSha: `f9f6b7dbc85e35453477824051ada1886fbdfd33`
- Fail 原因:
  - segment: `segment_execute_not_ok:unknown`（execute ok=false, reason未設定）
  - composer_cap_block: `notification not active`（通知がactiveでないため plan が 400）
- Trace:
  - segment: `trace-stg-e2e-segment-20260214141852`
  - retry_queue: `trace-stg-e2e-retry-queue-20260214141901`
  - kill_switch_block: `trace-stg-e2e-kill-switch-block-20260214141903`
  - composer_cap_block: `trace-stg-e2e-composer-cap-block-20260214141905`
- Artifacts:
  - `stg-notification-e2e-20260214141833.json`
  - `stg-notification-e2e-20260214141833.md`

## Follow-up Run 14
- `composer_cap_block` が FAIL、`segment` / `retry_queue` / `kill_switch_block` は PASS。
- 該当 run: `22018973539`（workflow_dispatch / ref=main）
- headSha: `f9f6b7dbc85e35453477824051ada1886fbdfd33`
- Fail 原因:
  - composer_cap_block: `notification not active`（通知がactiveでないため plan が 400）
- Trace:
  - segment: `trace-stg-e2e-segment-20260214142409`
  - retry_queue: `trace-stg-e2e-retry-queue-20260214142412`
  - kill_switch_block: `trace-stg-e2e-kill-switch-block-20260214142414`
  - composer_cap_block: `trace-stg-e2e-composer-cap-block-20260214142416`
- Artifacts:
  - `stg-notification-e2e-20260214142348.json`
  - `stg-notification-e2e-20260214142348.md`

## Follow-up Run 15
- `segment` / `retry_queue` / `kill_switch_block` / `composer_cap_block` 全て PASS。
- 該当 run: `22019381909`（workflow_dispatch / ref=main）
- headSha: `f9f6b7dbc85e35453477824051ada1886fbdfd33`
- Trace:
  - segment: `trace-stg-e2e-segment-20260214145545`
  - retry_queue: `trace-stg-e2e-retry-queue-20260214145548`
  - kill_switch_block: `trace-stg-e2e-kill-switch-block-20260214145551`
  - composer_cap_block: `trace-stg-e2e-composer-cap-block-20260214145552`
- Artifacts:
  - `stg-notification-e2e-20260214145522.json`
  - `stg-notification-e2e-20260214145522.md`

## Infra Fix (Index)
- Firestore composite index 作成（audit_logs の query 失敗を解消）:
  - `collectionGroup=audit_logs`
  - fields: `action ASC`, `templateKey ASC`, `createdAt DESC`, `__name__ DESC`
- 作成記録:
  - operation: `projects/member-485303/databases/(default)/operations/S0U0aFhqT2dBQ0lDDCoDIDAzMTUwNDNjZTJkMS0xNmI4LTJiYzQtZDg1ZS0yYmFkYTBjNiQac2VuaWxlcGlwCQpBEg`
  - index: `projects/member-485303/databases/(default)/collectionGroups/audit_logs/indexes/CICAgOjXh4EK`
- 結果:
  - index state: `READY`

## Scope
- stg e2e workflow の secret preflight を「missing」と「permission不足」に分離。
- missing は fail-fast、permission不足は warning/notice で継続。
 - GitHub Secrets から `ADMIN_OS_TOKEN` を供給できる導線を追加。
   - secrets が存在する場合は Secret Manager 参照を省略。
 - Cloud Run proxy に identity token を明示付与し、private service でも認証可能にする。
 - Auth action の `id_token` を使って proxy token を付与する（audience = service URL）。
 - Firestore composite index の作成（audit_logs query の 9_FAILED_PRECONDITION 対応）。

## Code Changes
- `.github/workflows/stg-notification-e2e.yml`
  - `NOT_FOUND` は error + exit 1
  - `PERMISSION_DENIED` は warning + notice で継続
  - `ADMIN_OS_TOKEN` が GitHub secrets にあればそれを使用
  - `gcloud auth print-identity-token --audiences <service url>` を使い、
    proxy に `--token` を渡す
  - `google-github-actions/auth@v2` の `token_format: id_token` で
    `id_token_audience` を service URL に固定し、`outputs.id_token` を proxy に渡す
  - Firestore composite index (audit_logs) を作成
- `tests/phase186/phase186_stg_e2e_secret_preflight_visibility_split.test.js`（新規）
  - 分岐ロジック（NOT_FOUND / permission warning / notice）を静的検証
  - GitHub secrets からの token 利用を静的検証
- `tools/run_stg_notification_e2e_checklist.js`
  - `segment_query_json` の loose 形式（`{lineUserIds:[U1,U2]}`）を許容
- `tests/phase186/phase186_stg_e2e_segment_query_loose_parse.test.js`（新規）
  - loose 形式の `segment_query_json` を parse できることを検証

## Local Verification
- `node --test tests/phase186/phase186_stg_e2e_secret_preflight_visibility_split.test.js` PASS
- `node --test tests/phase186/phase186_stg_e2e_segment_query_loose_parse.test.js` PASS
- `npm test` PASS

## Rollback
- 本PRを revert し、stg e2e preflight を直前実装に戻す。
