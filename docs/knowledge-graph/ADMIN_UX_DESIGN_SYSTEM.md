# ADMIN_UX_DESIGN_SYSTEM

- generatedAt: 2026-03-11T23:59:00-05:00
- designMode: Knowledge Graph Workbench
- constraints: add-only / route contract維持 / SSOT辞書準拠

## 1. Design Intent
管理UIを「画面の集合」ではなく、次の因果を扱う Workbench として設計する。
- 入力（parameter）
- 判定（operation）
- 書込/読取（entity）
- 証跡（audit/trace）

根拠:
- pane 単一shell: `apps/admin/app.html:10,231-4552`
- route->pane契約: `src/shared/adminUiRoutesV2.js:3-67`
- ops dispatch集約: `src/index.js:2207-2460`

## 2. UX Layer Model

| Layer | Primary Pane | UX Responsibility | Evidence |
| --- | --- | --- | --- |
| Dashboard | `home` | 状態判断のみ（KPI） | `apps/admin/app.html:265-521` |
| Workbench | `composer`, `city-pack`, `vendors` | 作業（入力->検証->実行） | `apps/admin/app.html:639-1015,2364-3298,3672-3867` |
| Data | `read-model`, `monitor` | 一覧/検索/状態把握 | `apps/admin/app.html:1019-2191,3409-3670` |
| LLM | `llm` | ポリシー管理と履歴確認 | `apps/admin/app.html:4154-4467` / `src/routes/admin/llmPolicyConfig.js:111-349` |
| Evidence | `audit`, `errors` | trace/recovery/監査根拠 | `apps/admin/app.html:3305-3406,3871-3938` |
| System | `ops-feature-catalog`, `ops-system-health`, `maintenance` | システム診断/保守 | `apps/admin/app.html:557-607,4552-4621` |

## 3. Layout System

### 3.1 Global Shell
- Sidebar: `.app-nav`
- Header/Topbar: `.app-topbar`
- Workspace: `.app-main` + `.app-pane`
- Right actions rail: `.pane-actions`（sticky）

Evidence:
- HTML: `apps/admin/app.html:10-228`
- CSS: `apps/admin/assets/admin.css:69-136,247-250`

### 3.2 Responsive Rules
- desktop -> 2-column shell
- narrow widths: nav/content reflow

Evidence:
- `apps/admin/assets/admin.css:385,395,1564,1872,2543,3133,3181`

## 4. Component and State Rules

### 4.1 Core status vocabulary
- status badge: `.badge` + `.badge-ok/.badge-warn/.badge-danger/.badge-info/.badge-disabled/.badge-unset`
- row health: `.row-health-ok/.row-health-warn/.row-health-danger`
- toast states: `.toast.state-success/.state-warn/.state-error/.state-forbidden/.state-disabled/.state-unset`

Evidence:
- `apps/admin/assets/admin.css:1237-1289,1369-1436`

### 4.2 Message hierarchy
- system-level: banner/top area
- pane-level: panel notices
- action-level: toast
- null-data states: `.empty-state`, `.loading-state`, `.error-state`

Evidence:
- `apps/admin/assets/admin.css:1445-1460`
- composer safety block `apps/admin/app.html:695-703`

### 4.3 No-collapse / no top summary constraints
- collapse UI is forcibly disabled
- top summary visibility is centrally controlled

Evidence:
- `apps/admin/assets/admin_app.js:3012-3029,3039-3049,18005`

## 5. Permission and Visibility Design Rules

| Rule | Implementation | Evidence |
| --- | --- | --- |
| Admin-only surface hiding | `[data-role="admin"]` hidden for operator | `apps/admin/app.html:3940,4050,4110,4154,4552` / `apps/admin/assets/admin.css:315-323` |
| Role switch guard | pane activation fallback on forbidden role | `apps/admin/assets/admin_app.js:2878-2919` |
| API auth guard | `/admin/*`, `/api/admin/*` require `adminToken` | `src/domain/security/protectionMatrix.js:22-23` |

## 6. UI Parameter Graph Integration Rules
- パラメータは UI id と API payload の両方で契約化する。
- 最低対象: `notificationType, scenarioKey, stepKey, targetRegion, targetLimit, membersOnly, notificationCategory, city-pack filters, vendor filters, llm-policy-*`。

Evidence:
- DOM IDs: `apps/admin/app.html:710-879,2488-2542,3699-3727,4319-4393`
- Payload builders: `apps/admin/assets/admin_app.js:14299-14340,2292-2335`

## 7. Phase13 Playwright UX Audit Anchors
現時点の実観測スクリーンショット（1440x900）:
- `artifacts/ui-ux-system-20260312/home-1440x900.png`
- `artifacts/ui-ux-system-20260312/composer-1440x900.png`
- `artifacts/ui-ux-system-20260312/monitor-1440x900.png`
- `artifacts/ui-ux-system-20260312/city-pack-1440x900.png`
- `artifacts/ui-ux-system-20260312/vendors-1440x900.png`
- `artifacts/ui-ux-system-20260312/read-model-1440x900.png`
- `artifacts/ui-ux-system-20260312/audit-1440x900.png`
- `artifacts/ui-ux-system-20260312/llm-1440x900.png`
- `artifacts/ui-ux-system-20260312/errors-1440x900.png`
- `artifacts/ui-ux-system-20260312/maintenance-1440x900.png`

## 8. SaaS Gap Inputs (Design-only, no implementation)
比較対象: Linear / Stripe / Notion / HubSpot。
この文書では「現行に存在する構造」だけを固定し、見た目改善の断定はしない。

## 9. Non-Goals
- 本ターンでの実装変更
- route/API 契約変更
- Firestore schema 変更

