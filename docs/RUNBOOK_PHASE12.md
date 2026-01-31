# Phase12 Runbook (Implementation Targets)

## Purpose
- CO1-D-001-A01 の固定参照が維持されていることを確認する

## Preconditions
- PUBLIC_BASE_URL が設定済みであること
- /admin/implementation-targets が到達可能であること

## Checks
1) API
- コマンド:
  - `curl -s "${PUBLIC_BASE_URL}/admin/implementation-targets"`
- 期待結果:
  - 配列
  - length = 1
  - id = CO1-D-001-A01
  - status = IN

2) UI
- URL: `${PUBLIC_BASE_URL}/admin/ops`
- 期待結果:
  - Implementation Targets セクションが表示される
  - 1件のみ表示される

3) CI
- `tests/phase12/implementationTargetsAcceptance.test.js` が PASS

## Rollback
- 直近PRの revert
