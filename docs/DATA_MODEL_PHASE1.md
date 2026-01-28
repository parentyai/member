# Data Model Phase1 (FIX)

Linked Task: P1-002

## users
- lineUserId (PK)
- scenario
- attributes { household, region, timing }
- createdAt (serverTimestamp)

## checklists
- checklistId (PK, Firestore autoID)
- scenario
- step
- items[]
  - itemId
  - title
  - linkRegistryId
  - order
- createdAt (serverTimestamp)

## user_checklists
- docId = ${lineUserId}__${checklistId}__${itemId}
- lineUserId
- checklistId
- itemId
- completedAt (timestamp | null)
- updatedAt (serverTimestamp)

## notifications
- notificationId (PK, Firestore autoID)
- scenario
- step
- message { title, body, ctaText }
- linkRegistryId
- sentAt (timestamp | null)
- createdAt (serverTimestamp)

## notification_deliveries
- deliveryId (PK, Firestore autoID)
- notificationId
- lineUserId
- sentAt (serverTimestamp)
- createdAt (serverTimestamp)

## events (append-only)
- eventId (PK, Firestore autoID)
- lineUserId
- type (open | click | complete)
- ref { notificationId?, checklistId?, itemId? }
- createdAt (serverTimestamp)

## Notes
- Linkは Phase0 Link Registry を参照する（linkRegistryId 固定）
- user_checklists は upsert 前提
- events は追記型（createのみ）
- 削除は原則禁止（状態で非表示）
