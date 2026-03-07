# TASK_DETAIL_OBSERVABILITY_V1

## Scope
- Task Detail（`TODO詳細`）の開封/続き/完了を、既存 authority を変更せず観測可能にする add-only 契約。
- Canonical task selection は既存の `computeNextTasks` と `tasks` projection を維持する。

## Event Contract
- Collection: `events`
- New event types:
  - `todo_detail_opened`
  - `todo_detail_section_opened`
  - `todo_detail_section_continue`
  - `todo_detail_completed`
  - `support_guide_opened`
- Required fields:
  - `lineUserId`
  - `type`
  - `ref.source`
- Optional fields:
  - `ref.todoKey`
  - `ref.taskKey`
  - `fields.sectionMeta`
  - `fields.attribution` (`notificationId`, `deliveryId`, `source`, `traceId`, `requestId`)
  - `fields.attributionKey`

## Attribution Contract
- `attributionKey` は次の優先順位で生成する:
  1. `delivery:{deliveryId}`
  2. `notification:{notificationId}:{lineUserId}:{todoKey}`
  3. `trace:{traceId}:{lineUserId}:{todoKey}`
  4. `todo:{lineUserId}:{todoKey}`
- `notification_deliveries` との厳密JOINを強制しない。まずは attribution key で追跡可能性を担保する。

## KPI Contract (add-only)
- `aggregateJourneyKpis` / `journey_kpi_daily` へ追加:
  - `detailOpenCount`
  - `detailSectionOpenCount`
  - `detailContinueCount`
  - `detailCompleteCount`
  - `detailOpenedAttributedCount`
  - `detailCompletedAttributedCount`
  - `detailOpenToContinueRate`
  - `detailOpenToCompleteRate`
  - `detailContinueToCompleteRate`
  - `deliveryToDetailToDoneRate`

## Non-goals
- 既存 completion authority の移管
- 新規 write model の導入
- 相談コマンドでの自動チケット作成

## Rollback
- 追加イベントは参照停止で無害化可能。
- 重大不整合時は PR revert で復元する。
