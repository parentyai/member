# JOURNEY_FUNNEL_EVENT_CONTRACT_V1

## Purpose
Journey KPI で使う event type と集計意味を固定し、運用・実装のズレを防ぐ。

## Funnel Definitions
- Detail Funnel:
  - Open: `todo_detail_opened`
  - Continue: `todo_detail_section_continue`
  - Complete: `todo_detail_completed`
- Local Guidance Funnel:
  - Region set: `city_region_declared`
  - Local open: `local_task_surface_opened`
- Reminder fatigue:
  - Sent: `journey_primary_notification_sent`
  - Guarded: `notification_fatigue_guarded`

## Aggregation Rules
- `detailOpenToContinueRate = detailContinueCount / detailOpenCount`
- `detailOpenToCompleteRate = detailCompleteCount / detailOpenCount`
- `detailContinueToCompleteRate = detailCompleteCount / detailContinueCount`
- `deliveryToDetailToDoneRate = detailCompletedAttributedCount / detailOpenedAttributedCount`

## Guardrails
- 分母0の場合は rate=0 とする。
- 大文字小文字差分は小文字正規化して評価する。
- 追加イベントは add-only。既存イベント意味を変更しない。

## Evidence Surface
- admin route: `/api/admin/os/journey-kpi`
- audit action: `journey_kpi.built`
- storage: `journey_kpi_daily/{dateKey}`
