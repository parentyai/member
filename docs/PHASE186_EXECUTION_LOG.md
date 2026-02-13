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

## Scope
- stg e2e workflow の secret preflight を「missing」と「permission不足」に分離。
- missing は fail-fast、permission不足は warning/notice で継続。
 - GitHub Secrets から `ADMIN_OS_TOKEN` を供給できる導線を追加。
   - secrets が存在する場合は Secret Manager 参照を省略。
 - Cloud Run proxy に identity token を明示付与し、private service でも認証可能にする。
 - Auth action の `id_token` を使って proxy token を付与する（audience = service URL）。

## Code Changes
- `.github/workflows/stg-notification-e2e.yml`
  - `NOT_FOUND` は error + exit 1
  - `PERMISSION_DENIED` は warning + notice で継続
  - `ADMIN_OS_TOKEN` が GitHub secrets にあればそれを使用
  - `gcloud auth print-identity-token --audiences <service url>` を使い、
    proxy に `--token` を渡す
  - `google-github-actions/auth@v2` の `token_format: id_token` で
    `id_token_audience` を service URL に固定し、`outputs.id_token` を proxy に渡す
- `tests/phase186/phase186_stg_e2e_secret_preflight_visibility_split.test.js`（新規）
  - 分岐ロジック（NOT_FOUND / permission warning / notice）を静的検証
  - GitHub secrets からの token 利用を静的検証

## Local Verification
- `node --test tests/phase186/phase186_stg_e2e_secret_preflight_visibility_split.test.js` PASS
- `npm test` PASS

## Rollback
- 本PRを revert し、stg e2e preflight を直前実装に戻す。
