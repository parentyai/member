# Acceptance Phase1

Linked Task: P1-007

## A. Data Persistence
- Given: Firestore 接続が有効
- When: ユーザーを作成する
- Then: users/{lineUserId} が作成される
- Evidence: Firestore `users/{lineUserId}` / expected fields `scenario, attributes, createdAt` / executedAt `YYYY-MM-DD` / executor `<name>`

- Given: 通知を作成する
- When: Adminで保存を実行する
- Then: notifications/{notificationId} が作成される
- Evidence: Firestore `notifications/{notificationId}` / expected fields `scenario, step, message, linkRegistryId, createdAt` / executedAt `YYYY-MM-DD` / executor `<name>`

- Given: checklist が存在する
- When: 完了トグルを行う
- Then: user_checklists/{docId} が upsert される
- Evidence: Firestore `user_checklists/{docId}` / expected fields `lineUserId, checklistId, itemId, completedAt, updatedAt` / executedAt `YYYY-MM-DD` / executor `<name>`

## B. Admin Operations
- Given: Link Registry にリンクが登録済み（linkRegistryId）
- When: Adminで通知作成・送信
- Then: notification_deliveries が作成され sentAt が記録される
- Evidence: Firestore `notification_deliveries/{deliveryId}` / expected fields `notificationId, lineUserId, sentAt` / executedAt `YYYY-MM-DD` / executor `<name>`

## C. Mini App
- Given: 対象ユーザーが存在
- When: /checklist を開く
- Then: items が表示される
- Evidence: UIスクショ / expected items `itemId,title,linkRegistryId,order` / executedAt `YYYY-MM-DD` / executor `<name>`

- Given: 未完了の item
- When: 完了トグル
- Then: completedAt が timestamp になる
- Evidence: Firestore `user_checklists/{docId}` / expected field `completedAt` / executedAt `YYYY-MM-DD` / executor `<name>`

## D. Events (append-only)
- Given: 通知を開く
- When: /inbox で閲覧
- Then: events(type=open) が追加される（ref.notificationId 必須）
- Evidence: Firestore `events/{eventId}` / expected fields `type, ref.notificationId, createdAt` / executedAt `YYYY-MM-DD` / executor `<name>`

- Given: CTA をクリック
- When: 公式リンクへ遷移
- Then: events(type=click) が追加される（ref.notificationId 必須）
- Evidence: Firestore `events/{eventId}` / expected fields `type, ref.notificationId, createdAt` / executedAt `YYYY-MM-DD` / executor `<name>`

- Given: checklist item を完了
- When: 完了トグル
- Then: events(type=complete) が追加される（ref.checklistId + ref.itemId 必須）
- Evidence: Firestore `events/{eventId}` / expected fields `type, ref.checklistId, ref.itemId, createdAt` / executedAt `YYYY-MM-DD` / executor `<name>`

## E. Safety
- Given: events 記録が失敗するケース
- When: 通知送信/完了トグルを実行
- Then: 主処理は成功し、events 失敗のみがログされる
- Evidence: log (events failure) / Firestore (主処理成功) / executedAt `YYYY-MM-DD` / executor `<name>`

## Evidence Log
| Area | Date (YYYY-MM-DD) | Executor | Evidence link | Notes |
| --- | --- | --- | --- | --- |
| A. Data Persistence |  |  |  |  |
| B. Admin Operations |  |  |  |  |
| C. Mini App |  |  |  |  |
| D. Events |  |  |  |  |
| E. Safety |  |  |  |  |
