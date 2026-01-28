# Playbook Phase1 E2E

Linked Task: P1-005

## Goal
Phase1の最小UX（通知 → 行動 → ログ、チェックリスト完了）を再現する。

## Admin通知 → 行動ログ
1) Adminで通知作成
   - Given: Link Registry に対象リンクが登録済み（linkRegistryId）
   - When: Admin画面で通知作成（linkRegistryId 指定）
   - Then: notifications が作成される
2) 通知送信
   - Given: 対象ユーザーが存在
   - When: Adminで送信実行
   - Then: notification_deliveries が作成され sentAt が記録される
3) 通知閲覧
   - Given: 通知一覧を表示
   - When: /inbox を開く
   - Then: events(type=open) が記録される
4) CTAクリック
   - Given: 通知を表示
   - When: CTAをクリック
   - Then: events(type=click) が記録される

## チェックリスト
1) Mini Appでチェックリスト表示
   - Given: checklists が存在
   - When: /checklist 表示
   - Then: items が表示される
2) 完了トグル
   - Given: 未完了の item
   - When: 完了トグル
   - Then: user_checklists が upsert され completedAt が更新される
   - Then: events(type=complete) が記録される

## Scenario/Step不整合
- Given: users.scenario と checklist.scenario が不整合
- When: /checklist を開く
- Then: 例外は出さず、UIは表示しない（ログのみ）

## Evidence
- Firestore path（notifications / notification_deliveries / events / user_checklists）
- Cloud Run logs（events記録）
