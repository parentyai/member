# Playbook Phase1 E2E

Linked Task: P1-007

## Goal
Phase1の最小UX（通知 → 行動 → ログ、チェックリスト完了）を再現する。

## Admin通知 → delivery
1) Adminで通知作成
   - Given: Link Registry に対象リンクが登録済み（linkRegistryId）
   - When: `POST /admin/phase1/notifications`
   - Then: notifications が作成される
2) 通知送信（scenario一致のみ）
   - Given: users.scenario が存在
   - When: `POST /admin/phase1/notifications/{id}/send`
   - Then: notification_deliveries が作成される（stepは無視）

## events（open/click/complete）
1) open 記録
   - When: `POST /api/phase1/events` (type=open, ref.notificationId)
   - Then: events に append される
2) click 記録
   - When: `POST /api/phase1/events` (type=click, ref.notificationId)
   - Then: events に append される
3) complete 記録
   - When: `POST /api/phase1/events` (type=complete, ref.checklistId+itemId)
   - Then: events に append される

## チェックリスト
1) Mini Appでチェックリスト表示
   - Given: checklists が存在
   - When: `GET /phase1/checklist?lineUserId=...&step=...`
   - Then: items が表示される（completedAt反映）
2) 完了トグル
   - When: `POST /api/phase1/mini/checklist/toggle`
   - Then: user_checklists が upsert され completedAt が更新される

## Scenario/Step不整合
- Given: users.scenario と checklist.scenario が不整合
- When: `/phase1/checklist` を開く
- Then: 例外は出さず、UIは表示しない（ログのみ）

## Evidence
- Firestore path（notifications / notification_deliveries / events / user_checklists）
- Cloud Run logs（events記録）
