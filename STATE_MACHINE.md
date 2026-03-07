# STATE_MACHINE.md

## 0. Source Constraint
State definitions are based only on audited documents.
No inferred backend-only state is added.

## 1. Composer Lifecycle State Machine

### 1.1 States (observed)
- `IDLE`
- `DRAFT`
- `PREVIEWED`
- `APPROVED`
- `PLANNED`
- `SENT`
- `WARN`
- `ERROR`

Evidence:
- `ADMIN_UI_WORKBENCH_AUDIT.md` (Phase3)
- JS transition handlers: `apps/admin/assets/admin_app.js:14569-14747`

### 1.2 Transitions

| From | Event | Guard | To | UI Feedback |
|---|---|---|---|---|
| IDLE | create draft | payload valid | DRAFT | toast ok + status update |
| IDLE/DRAFT | preview | payload valid | PREVIEWED | toast ok |
| DRAFT | approve | confirm + notificationId | APPROVED | toast ok |
| APPROVED | send plan | notificationId | PLANNED | planHash/confirmToken set |
| PLANNED | send execute | confirm + planHash + confirmToken | SENT | toast ok |
| any | validation fail | payload invalid | WARN | toast warn + inline result |
| any | API fail | request failed | ERROR | toast danger |

## 2. Dashboard Load State Machine

### 2.1 States (observed)
- `NORMAL`
- `DEGRADED_BLOCKED` (local preflight blocks loads)
- `DATA_EMPTY_OR_FAILED`

Evidence:
- `ADMIN_UI_STRUCTURE.md` section 5, 8
- `apps/admin/assets/admin_app.js:1600-1652`

### 2.2 Transitions

| From | Event | Condition | To |
|---|---|---|---|
| NORMAL | local preflight fails | `isLocalPreflightBlockingDataLoads()` true | DEGRADED_BLOCKED |
| DEGRADED_BLOCKED | rerun preflight success | `ready===true` | NORMAL |
| NORMAL | data load failure | API error | DATA_EMPTY_OR_FAILED |
| DATA_EMPTY_OR_FAILED | reload success | API success | NORMAL |

## 3. Monitor Mode State Machine

### 3.1 States (observed)
- `MONITORING_VIEW`
- `CONFIG_MIXED_VIEW` (current mixed runtime/config block)
- `INSIGHTS_ERROR`

Evidence:
- `ADMIN_UI_WORKBENCH_AUDIT.md` Flow section
- `apps/admin/app.html:1552-1707`, `1827-2011`

### 3.2 Transition signals
- pane open -> monitor blocks render
- insights fetch fail -> diagnostics error text shown
- runtime config actions -> confirm/post flow

## 4. City Pack Item State Machine (UI-observed labels)

### 4.1 States (observed in filters/options)
- `queued`
- `drafted`
- `needs_review`
- `approved`
- `active`
- `rejected`
- `failed`
- `new`
- `triaged`
- `resolved`
- `proposed`
- `draft`
- `sent`
- `retired`
- `blocked`
- `dead`

Evidence:
- `apps/admin/app.html:2458-2473`
- `ADMIN_UI_STRUCTURE.md` Phase4 table

### 4.2 Transition note
- UI shows action buttons per row/context, but full transition graph is not fully observable without executing writes.
- Therefore transition edges are marked partially observed.

## 5. Permission / Visibility State Machine

### 5.1 Role states
- `operator`
- `admin`
- `developer`

Evidence:
- `apps/admin/app.html:154-156`
- `apps/admin/assets/admin_app.js:2733-2787`

### 5.2 Visibility states
- `VISIBLE`
- `HIDDEN_BY_ROLE` (`role-hidden`)
- `HIDDEN_BY_FLAG` (`is-hidden-by-flag`)
- `HIDDEN_BY_GROUP_POLICY`

Evidence:
- `apps/admin/assets/admin_app.js:2637-2718`
- `apps/admin/assets/admin.css:319`, `2860`

## 6. System Banner State Machine

### 6.1 States
- `UNSET`
- `WARN`
- `DANGER`
- `SUCCESS` (fixture path)

Evidence:
- banner markup: `apps/admin/app.html:195-220`
- fixture success rendering: `apps/admin/assets/admin_app.js:3906-3919`

### 6.2 Transition
- preflight load result changes banner state
- local recovery recheck can move from danger/warn to normal

## 7. Unobserved

1. Full backend-confirmed transition edges for City Pack status set.
2. Success-state rendering after actual write execution in production-like data.
3. Complete rollback state representation for all write actions.
