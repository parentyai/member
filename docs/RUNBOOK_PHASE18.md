# Phase18 Runbook（CTA文言差分・事実記録）

## Purpose
- CTA文言差分（A/B）を同条件で送信し、OBSログの事実を記録する
- 評価・判断は行わない

## Scope
- 対象: /admin/notifications 作成、/admin/notifications/{id}/test-send、/track/click、[OBS]ログ
- 非対象: 仕様変更 / UX改善 / 自動判断 / 最適化

## Preconditions
- 認証手順は RUNBOOK_PHASE13.md に従う（Cloud Run IAM）
- 固定 lineUserId を使用する
- 有効な linkRegistryId を用意する

## 手順（A/Bの2件のみ）
1) Link Registry を用意
   - /admin/link-registry を使用して1件作成
   - linkRegistryId を記録

2) 通知A/Bを作成（文言のみ差分）
   - /admin/notifications を2件作成
   - ctaText を A/B で差分にする
   - notificationId(A) / notificationId(B) を記録

3) test-send を各1回実行
   - /admin/notifications/{id}/test-send を A/B それぞれ1回のみ実行
   - requestId / deliveryId を記録

4) click 記録（必要時のみ）
   - /track/click を A/B 各1回のみ実行
   - deliveryId / linkRegistryId を使用
   - requestId を記録

## OBSログ最小確認
- [OBS] action=test-send result=ok の行を取得
- 同一 requestId で lineUserId / notificationId / deliveryId を記録
- click を実行した場合のみ [OBS] action=click result=ok を記録

## 事実記録テンプレ（A/Bそれぞれ）
- 実行日時(UTC):
- main SHA:
- lineUserId(マスク):
- linkRegistryId:
- notificationId:
- ctaText:
- requestId (test-send):
- deliveryId:
- test-send result (ok/error):
- click 実行: Yes/No
- requestId (click):
- click result (ok/reject/error):
- OBSログ抜粋:

## 禁止事項
- 追加送信
- 評価・判断・改善提案
- 仕様変更 / 実装変更
