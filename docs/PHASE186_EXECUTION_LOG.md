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

## Scope
- stg e2e workflow の secret preflight を「missing」と「permission不足」に分離。
- missing は fail-fast、permission不足は warning/notice で継続。
 - GitHub Secrets から `ADMIN_OS_TOKEN` を供給できる導線を追加。
   - secrets が存在する場合は Secret Manager 参照を省略。

## Code Changes
- `.github/workflows/stg-notification-e2e.yml`
  - `NOT_FOUND` は error + exit 1
  - `PERMISSION_DENIED` は warning + notice で継続
  - `ADMIN_OS_TOKEN` が GitHub secrets にあればそれを使用
- `tests/phase186/phase186_stg_e2e_secret_preflight_visibility_split.test.js`（新規）
  - 分岐ロジック（NOT_FOUND / permission warning / notice）を静的検証
  - GitHub secrets からの token 利用を静的検証

## Local Verification
- `node --test tests/phase186/phase186_stg_e2e_secret_preflight_visibility_split.test.js` PASS
- `npm test` PASS

## Rollback
- 本PRを revert し、stg e2e preflight を直前実装に戻す。
