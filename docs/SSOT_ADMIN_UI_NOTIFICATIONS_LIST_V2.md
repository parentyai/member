# SSOT Admin UI Notifications List V2

## Scope
- Target page: `/admin/app` monitor pane (`data-pane="monitor"`).
- This contract defines a two-list layout for notification operations.
- API paths and Firestore schema are unchanged.

## Purpose
- Upper list: user-scoped delivery history lookup.
- Lower list: global notifications list for operational overview.
- Deprecated monitor sub-sections are hidden from operator UI:
  - detail panel
  - action panel
  - Journey Map / Rule Editor

## Layout Contract
1. User history search (upper)
- Inputs:
  - `#monitor-user-line-user-id` (LINE user ID)
  - `#monitor-user-member-id` (memberId)
  - `#monitor-user-limit` (1..200, default 50)
- Trigger:
  - `#monitor-user-search`
- Query priority:
  - If both LINE user ID and memberId are present, LINE user ID is used.
- Empty result message:
  - `該当する通知履歴がありません`
- Table body:
  - `#monitor-user-rows`

2. Global notifications list (lower)
- Reload trigger:
  - `#monitor-global-reload`
- Data source:
  - `/api/admin/os/notifications/list?limit=100`
  - `/admin/read-model/notifications?limit=500` (merge for last execution summary)
- Table body:
  - `#monitor-rows`
- Columns:
  - 作成日時
  - 状態
  - type
  - タイトル
  - シナリオ
  - ステップ
  - target概要
  - lastPlanHash
  - lastExecution概要

## API Compatibility Contract
- Existing APIs are reused:
  - `GET /api/admin/notification-deliveries`
  - `GET /api/admin/os/notifications/list`
  - `GET /admin/read-model/notifications`
- Add-only query alias:
  - `memberId` is accepted as an alias for `memberNumber` on `GET /api/admin/notification-deliveries`.
- Legacy query `memberNumber` remains supported.

## Non-goals
- No deletion of backend routes/usecases.
- No Firestore schema meaning changes.
- No route path changes.
