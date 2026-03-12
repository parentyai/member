# ADMIN_UI_COMPONENT_LIBRARY

- generatedAt: 2026-03-11T23:59:00-05:00
- scope: 現行 Admin shell で既に存在する UI コンポーネント契約（実装追加なし）

## Component Inventory

| Component | Current Selector/ID | Purpose | States | Operation Hooks | Evidence |
| --- | --- | --- | --- | --- | --- |
| `SidebarNav` | `.app-nav`, `.nav-link[data-pane-target]` | pane navigation | active/inactive/role-hidden | `activatePane()` | `apps/admin/app.html:10-176` / `apps/admin/assets/admin_app.js:4129-4276` |
| `PageHeader` | `.page-header`, `#page-title`, `#page-subtitle` | page context title/subtitle | role/route dependent | history+role sync | `apps/admin/app.html:177-228` / `apps/admin/assets/admin_app.js:4219-4230` |
| `PanelCard` | `.panel-title` + `.panel-body` | section wrapper | default/empty/error | pane-specific loaders | `apps/admin/app.html:250-4556` |
| `DecisionHeader` | `.decision-title` | page-level decision context | by pane | nav-dict text | `apps/admin/app.html:234,642,1022,2367,3308,3412,3675` |
| `ActionRail` | `.pane-actions` | high-impact actions | visible/hidden/sticky | button handlers | `apps/admin/app.html:2152-2168,3201-3298,3383-3400` / `apps/admin/assets/admin.css:247-250` |
| `FormInput` | `input`, `textarea`, `select` in composer/city/llm | parameter entry | valid/invalid/disabled | payload builders | `apps/admin/app.html:710-879,2385-2466,4319-4393` / `apps/admin/assets/admin_app.js:14299-14340` |
| `TableCompact` | `.table-compact` | dense operational list | sortable/selected/row-health | filter/sort state persistence | `apps/admin/app.html:565-593,965-976,2573-2585,3557-3578,3741-3751` / `apps/admin/assets/admin_app.js:2292-2335` |
| `TableSortButton` | `.table-sort-btn[data-*-sort-key]` | column sorting | asc/desc/reset | list-state persistence | `apps/admin/app.html:969-976,2577-2585,3560-3578,3745-3751` |
| `FilterGrid` | `.filters-grid` + `#*-filter-*` | query parameters | default/with chips | reload actions | `apps/admin/app.html:2487-2567,3437-3506,3698-3735` |
| `FilterChips` | `#city-pack-unified-filter-chips`, `#vendor-unified-filter-chips` | applied filter visibility | empty/active | filter clear/apply | `apps/admin/app.html:2567,3735` |
| `StatusBadge` | `.badge` family | status semantics | ok/warn/danger/info/disabled/unset | read-only visual state | `apps/admin/app.html:667,698,2074-2075` / `apps/admin/assets/admin.css:1254-1289` |
| `RowHealth` | `.row-health-*` | row-level health signal | ok/warn/danger | list rendering | `apps/admin/assets/admin.css:1237-1247` |
| `Toast` | `.toast` | operation feedback | success/pending/warn/error/forbidden/disabled | postJson success/failure handlers | `apps/admin/assets/admin.css:1369-1436` |
| `StateBlock` | `.empty-state`, `.loading-state`, `.error-state` | data fetch fallback states | empty/loading/error | fetch/render branches | `apps/admin/assets/admin.css:1445-1460` |
| `HelpTip` | `[data-dict-tip]` | inline semantic help | present/absent | dictionary binding | `apps/admin/app.html:710,720,724,728,767,975` |
| `RoleGuard` | `[data-role]`, `[data-role-allow]` | role-based component visibility | visible/hidden | `setRole` | `apps/admin/app.html:3940,4050,4110,4154,4552` / `apps/admin/assets/admin.css:315-323` / `apps/admin/assets/admin_app.js:2878-2919` |

## Button Contract

| Button Type | Selector Pattern | Expected Usage | Evidence |
| --- | --- | --- | --- |
| Primary | `.btn.btn-primary` | irreversible/major flow step | `apps/admin/app.html:672-675,4392` |
| Secondary | `.btn.btn-secondary` | safe read/reload/check actions | `apps/admin/app.html:271,564,590,3324` |
| Danger | `.btn.btn-danger` | destructive/recovery/disable actions | `apps/admin/app.html:3325,3389` |

## Parameterized Controls (Required by UX System)
- Notification workbench: `#notificationType`, `#scenarioKey`, `#stepKey`, `#targetRegion`, `#targetLimit`, `#membersOnly` (`apps/admin/app.html:710-879`)
- Data tables: users/city-pack/vendors unified filters (`apps/admin/app.html:2488-2542,3437-3506,3699-3727`)
- LLM operations: `#llm-policy-*` policy controls (`apps/admin/app.html:4319-4408`)

## Component Gaps (Observed, no implementation in this turn)
- Table toolbar semantics are not fully uniform across panes (class naming and action placement differ).
- `status` meaning is spread across badge/row-health/text labels and needs one canonical dictionary mapping.

