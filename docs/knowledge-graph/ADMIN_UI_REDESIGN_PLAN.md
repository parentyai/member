# ADMIN_UI_REDESIGN_PLAN

- generatedAt: 2026-03-11T23:59:00-05:00
- mode: design plan only (no implementation in this document)
- baseline: canonical route/pane contracts preserved

## Baseline Contracts (Must Keep)
1. Canonical shell route: `/admin/app`（`src/shared/adminUiRoutesV2.js:5-10`）
2. Legacy redirects to pane routes（`src/shared/adminUiRoutesV2.js:11-67`）
3. Admin auth guard for `/admin/*` and `/api/admin/*`（`src/domain/security/protectionMatrix.js:22-23`）
4. Admin API dispatch contract（`src/index.js:2207-2460`）

## Goal
管理UIを「機能リンク集」から「Knowledge Graph Workbench」へ移行する。

## Current Pain Anchors (Observed)
- Composer で入力/一覧/マップ/操作が同居し認知負荷が高い（`apps/admin/app.html:639-1015`）
- Monitor に監視/設定/診断が混在（`apps/admin/app.html:1019-2191`）
- City Pack は inbox/detail/editor が同一pane内に密集（`apps/admin/app.html:2364-3298`）
- Status semantic が badge/row/text に分散（`apps/admin/assets/admin.css:1237-1289`）

## PR Plan (7 steps)

### PR1 Navigation 整理
- Objective: 左ナビを責務単位に固定し重複導線を除去
- Target files:
  - `apps/admin/app.html` (nav grouping)
  - `apps/admin/assets/admin_app.js` (nav activation policy)
  - `docs/SSOT_ADMIN_UI_ROUTES_V2.md` (if label contract changes)
- Guardrails:
  - pane id/route mapping 互換維持
  - `test:admin-nav-contract` pass
- Evidence anchor: `apps/admin/app.html:12-176`, `apps/admin/assets/admin_app.js:774-996,4129-4276`

### PR2 Dashboard 再設計
- Objective: dashboard を判断専用へ縮約
- Scope: `home` pane only
- Keep: KPI read-only contract (`/api/admin/os/dashboard/kpi`)
- Evidence anchor: `apps/admin/app.html:231-521`, `src/index.js:2215-2217`

### PR3 Notification Workbench
- Objective: composer を state-machine 前提で再配置
- Scope:
  - state bar + editor + validation + execute trail
- Keep: existing operation endpoints
  - draft/preview/approve/plan/execute/list
- Evidence anchor:
  - `apps/admin/assets/admin_app.js:15098-15292`
  - `src/routes/admin/osNotifications.js:122-495`
  - `src/usecases/adminOs/planNotificationSend.js:95-214`

### PR4 Data UI
- Objective: read-model/city-pack/vendors を table-workbench 化
- Scope:
  - filter/search/sort/action 導線統一
- Keep:
  - city packs API family (`src/index.js:1219-1327`)
  - vendors API family (`src/index.js:1104-1132`)
- Evidence anchor:
  - `apps/admin/app.html:2488-2585,3437-3578,3699-3751`
  - `apps/admin/assets/admin_app.js:2292-2335`

### PR5 Evidence UI
- Objective: traceId中心で audit/errors/evidence を再編
- Scope:
  - audit pane and cross-links from workbench actions
- Keep:
  - appendAuditLog path
- Evidence anchor:
  - `apps/admin/app.html:3871-3938,3305-3406`
  - `src/routes/admin/osNotifications.js:133-141,380-395`
  - `src/routes/admin/cityPacks.js:166-187,345-357`

### PR6 System UI
- Objective: system diagnostics を operator workflow から分離
- Scope:
  - ops-feature-catalog / ops-system-health / maintenance consolidation
- Keep:
  - local preflight/recovery runbook
- Evidence anchor:
  - `apps/admin/app.html:557-607,4552-4621`
  - `docs/RUNBOOK_ADMIN_OPS.md:194-213`

### PR7 Visual System
- Objective: token/state component rulesを統一し、画面間の状態解釈を固定
- Scope:
  - badge/state/row/toast/empty-loading-error
- Keep:
  - existing token base in `admin.css`
- Evidence anchor:
  - `apps/admin/assets/admin.css:1-44,1237-1289,1369-1460`

## Verification Gates per PR
- `npm run test:docs`
- `npm run test:admin-nav-contract`
- pane affected snapshots refresh (Playwright artifacts path)

## Rollback Strategy
- PR単位revert（機能横断一括変更を避ける）
- route/API contract は維持前提のため UIのみ巻戻し可能
- emergency fallback: legacy redirect routes remain usable (`src/shared/adminUiRoutesV2.js:11-67`)

## Risks
1. Nav grouping 変更による到達不能リスク
   - detection: `test:admin-nav-contract`
2. Status統一時の既存意味破壊
   - detection: screenshot diff + state mapping tests
3. Composer state flow再編で送信経路崩壊
   - detection: operation contract tests (`draft -> plan -> execute`)

## Non-Goals
- Firestore schema 変更
- backend business logic 変更
- external UI library adoption

