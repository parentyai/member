# Phase18 Runbook（CTA文言差分・運用手順）

## 目的
- CTA文言差分（A/B）を同条件で送信し、観測事実を記録する
- 評価・判断は行わない

## 対象
- /admin/notifications（通知作成）
- /admin/notifications/{id}/test-send（送信）
- /track/click（クリック計測）
- [OBS] ログ（requestId / lineUserId / deliveryId）

## 非対象
- 仕様変更
- UX改善
- 自動判断
- 最適化

## A/Bの割当単位
- 通知ID単位で分ける
  - A: notificationId_A
  - B: notificationId_B
- 同一 lineUserId に対して A/B を各1回のみ実行

## 具体手順（最小）
1) linkRegistryId を用意する
2) 通知A/Bを作成する（文言のみ差分）
3) A/B をそれぞれ test-send で1回送信する
4) 受信後、必要なら1回だけ click を送る
5) OBSログを requestId で取得し記録する

## 観測項目（事実のみ）
- requestId
- lineUserId
- notificationId
- linkRegistryId
- deliveryId
- action=test-send の result
- action=click の result（実行した場合のみ）

## フラグ操作
- PHASE18_CTA_EXPERIMENT=1 のときのみ計測が有効
- 実験を行わない場合は PHASE18_CTA_EXPERIMENT を設定しない

## 失敗時切り戻し
- PHASE18_CTA_EXPERIMENT を未設定に戻す
- もしくは直近PRを revert

## 禁止事項
- 結果の解釈
- 仕様変更
- 実装変更
