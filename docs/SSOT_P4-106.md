# SSOT P4-106 — Human Decision Design (Read-only)

## Purpose
P4-106 は、人間が判断できる状態を完成させるための設計のみを行う。

## Preconditions
- Mini: memberNumber 入力 / checklist トグルが完了している
- Admin: READ ONLY 集計 / 運用サマリーが完了している
- 既存データは参照のみ（書き戻しなし）

## Scope (Design Only)
- 人間判断モデルの設計
- 概念レベルの状態モデル
- 判断不能ケースの明文化
- Phase5 への受け渡し条件

## Non-Goals
- 実装コードの追加・修正
- 既存仕様（Phase0-4）の変更
- UI/API/Firestore/権限/CI/CD の変更
- 自動判断・最適化・推薦

## Human Decision Model (Step Table)
| Who | When | What (Inputs) | Decision |
| --- | --- | --- | --- |
| Admin 運用者 | 定例（週次）/ 緊急時 | ユーザー状態一覧（memberNumber 有無 / checklist 完了数 / 最終アクション日時） | そのユーザーに対して「次に確認すべき情報があるか」判断する |
| Admin 運用者 | 定例（週次）/ 緊急時 | 通知状態一覧（notificationId / sentAt / open 数 / click 数 / 最終反応日時） | 「次に人手で通知を作成するか」判断する |
| Admin 運用者 | 定例（週次）/ 緊急時 | READ ONLY 集計・運用サマリー | 判断を保留するか / 何もしないか決める |

### Decision Results
- 判断結果はどこにも書き戻さない（記録しない）
- 判断結果による自動処理は行わない

## Conceptual State Models (Text)
### User State (Conceptual)
- Known: lineUserId が存在する
- MemberNumberSet: memberNumber が存在する
- ChecklistProgress: checklist 完了数が 0 以上
- NoAction: 最終アクションが存在しない
- LastActionKnown: 最終アクション日時が存在する

Transitions (conceptual only)
- Known -> MemberNumberSet (memberNumber 入力がある)
- Known -> ChecklistProgress (checklist 完了がある)
- Known -> LastActionKnown (events が存在する)
- Known -> NoAction (events が存在しない)

### Notification State (Conceptual)
- Sent: sentAt が存在する
- Opened: open 数が 1 以上
- Clicked: click 数が 1 以上
- NoReaction: open/click が 0
- LastReactionKnown: 最終反応日時が存在する

Transitions (conceptual only)
- Sent -> Opened (open が発生)
- Sent -> Clicked (click が発生)
- Sent -> NoReaction (open/click がない)
- Opened/Clicked -> LastReactionKnown (最終反応がある)

### Operational State (Conceptual)
- ReviewReady: ユーザー状態/通知状態が閲覧可能
- ReviewBlocked: 情報不足または矛盾で判断不能
- ReviewDeferred: 判断しないと決める

## Non-Decision Cases (Must Do Nothing)
- 情報不足: memberNumber も checklist も events も存在しない
- 矛盾: open/click があるが notificationId が解決できない
- 判断保留: 人間が「判断しない」を選択

Result: いずれも「何もしない」。書き戻しや自動処理は行わない。

## Phase5 Handoff
### Decision Materials to Provide
- ユーザー状態一覧（memberNumber 有無 / checklist 完了数 / 最終アクション日時）
- 通知状態一覧（sentAt / open / click / 最終反応日時）
- 判断不能ケース一覧

### Phase5 Allowed Implementation Scope
- 人間判断の結果を安全に記録・参照できる仕組みの実装
- UI 上で判断履歴を保存・参照できる範囲の実装

### Phase5 Still Forbidden
- 自動判断・自動送信
- AI 推薦・最適化
- 既存フェーズ仕様の変更
