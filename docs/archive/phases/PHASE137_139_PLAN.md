# PHASE137_139_PLAN

## Goal
LINE通知 → 配信（notification_deliveries）→ 反応（click/read）→ 集計 → 管理UI表示 を「数字で閉じる」。

## Scope In
- deliveries（notification_deliveries）をSSOTとして通知単位の反応集計（sent/clicked/read/ctr/lastReactionAt）を再計算可能にする（保存しない）。
- /admin/read-model/notifications のレスポンスに add-only で reactionSummary / notificationHealth を付与。
- 管理UI（apps/admin/read_model.html）にCTR/healthの表示を add-only で追加。

## Scope Out
- 自動運用（送信/実行の自動化）
- 既存API/既存レスポンスの意味変更
- LINE以外のチャネル追加

## Compatibility
- add-only（既存キーの意味変更なし、追加キーのみ）

## Tests
- Phase137: notification_deliveries→集計値（sent/clicked/read/ctr/lastReactionAt）
- Phase138: read-modelに reactionSummary / notificationHealth が常に存在し、既存キーが壊れない
- Phase139: sent/ctr閾値による OK/WARN/DANGER 固定

## Rollback
- revert 実装PR
- revert docs CLOSE PR

