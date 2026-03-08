# SSOT_VENDOR_RELEVANCE_SHADOW_V1

## Purpose
- Vendor relevance の算出を本番表示へ即反映せず、shadow観測で安全に評価する。
- 既存の `TODO業者:todoKey` 表示順は既定で維持する。

## Scope (add-only)
- Usecase: `src/usecases/journey/computeVendorRelevanceScore.js`
- Entry: `src/usecases/journey/handleJourneyLineCommand.js` (`todo_vendor`)
- Admin read model: `GET /api/admin/vendors/shadow-relevance`

## Flags
- `ENABLE_VENDOR_RELEVANCE_SHADOW_V1`（default: `true`）
  - `1`: shadow score を算出し event/audit に記録する。
  - `0`: shadow算出を停止する（既存表示のみ）。
- `ENABLE_VENDOR_RELEVANCE_SORT_V1`（default: `false`）
  - `1`: `todo_vendor` 表示順へ relevance 並び替えを適用する。
  - `0`: 既存順を維持する。

## Input Contract
- `regionKey`
- `modulesSubscribed`
- `taskCategory`
- `recommendedVendorLinkIds`
- `vendor health`（legacy healthy 判定）
- `assignmentContext`（`householdType` / `departureDate` / `assignmentDate`）
- `traceId`

## Output Contract
- `relevanceScore`
- `scoreBreakdown`
- `explanationCodes`
- `currentOrderLinkIds`
- `rankedLinkIds`
- `traceId`

## Evidence Contract
- Event: `todo_vendor_shadow_scored`
  - `lineUserId`, `traceId`, `requestId`
  - `ref.todoKey`, `ref.sortApplied`
  - `shadow.currentOrderLinkIds`, `shadow.rankedLinkIds`, `shadow.items[]`
- Event (error): `todo_vendor_shadow_failed`
- Audit:
  - `journey.todo_vendor.shadow_scored`
  - `journey.todo_vendor.shadow_scored.sort_applied`
  - `journey.todo_vendor.shadow_failed`

## Guardrails
- notification guard（CTA=1 / link_registry必須 / WARN block / kill switch）は変更しない。
- default は shadow only（表示順変更なし）。
