# Phase13 Operations Handoff

## 1. 運用対象の定義
- 対象: GET /admin/implementation-targets, /admin/ops の Implementation Targets 表示, Phase12 受入検証テスト
- 非対象: 判断ロジック, 対象拡張, CO-002/CO-003 への波及

## 2. 正常系確認（Daily / Weekly）
### Daily
- API: GET /admin/implementation-targets
  - 期待値: 配列 / length=1 / id=CO1-D-001-A01 / status=IN
- UI: /admin/ops の Implementation Targets に 1件表示

### Weekly
- CI: tests/phase12/implementationTargetsAcceptance.test.js が存在することを確認

## 3. 監視・検知（Signals）
- 異常条件: 配列長≠1 / id変更 / status変更 / API 500
- 検知手段: acceptance テストの FAIL または運用確認での検知

## 4. 障害対応（Runbook）
- API不達: 直近PRの確認 → revert
- UI表示不可: ops_readonly.html の差分確認 → revert
- 判断劣化: acceptance テスト失敗 → 直近PR revert

## 5. リリースゲート（GO / NO-GO）
- GO: API/ UI が期待値を満たす
- NO-GO: 対象増加 / ID変更 / status変更

## 6. 切り戻し（Rollback）
- 該当PRの revert のみ
- 切り戻し後に API/ UI を再確認
