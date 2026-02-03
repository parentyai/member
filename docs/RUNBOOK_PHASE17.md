# Phase17 Runbook (Operational Minimum)

## Purpose
- 通知フローが実運用で壊れないことを7日間で証明する
- 成功/失敗は OBS ログのみで判断する

## Scope
- 対象: 既存 LINE 通知送信フロー（管理API test-send 等の送信経路）
- 観測: [OBS] ログ（requestId / lineUserId / deliveryId）
- 非対象: 新機能 / UX改善 / 設計変更 / LLM連携

## Execution Rules
- 送信対象: 固定の lineUserId 1件
- 頻度: 1日1回まで
- 失敗時: 修正せず、OBSログに事実を記録
- 変更が必要な場合: 1PR=1論点 / 即revert可能

## Daily Procedure (7 days)
1) 送信準備
   - 当日の requestId を生成
   - 固定 lineUserId を使用
2) 送信実行
   - 管理API test-send で1件のみ送信
3) OBS確認
   - [OBS] action=test-send の行を取得
   - requestId / lineUserId / deliveryId を記録
4) 結果記録
   - PASS/FAIL を OBS 事実のみで記録

## Evidence Log (Daily)
- 日付(UTC):
- requestId:
- lineUserId:
- notificationId:
- deliveryId:
- result (ok/error):
- OBSログ抜粋:
- 判定 (PASS/FAIL):

## Failure Handling
- 追加送信は禁止
- 原因推測は禁止
- OBSログを記録して終了

## Success Criteria (7 days)
- 致命的障害なし
- 失敗時に requestId で追跡可能
