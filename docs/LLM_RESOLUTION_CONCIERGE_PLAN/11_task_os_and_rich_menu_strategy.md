# 11 Task OS And Rich Menu Strategy

## Observed baseline

### Task OS / journey facts observed in repo

- journey command lane:
  - `src/usecases/journey/handleJourneyLineCommand.js`
  - commands include:
    - `TODO一覧`
    - `今日の3つ`
    - `TODO詳細:todoKey`
    - category views
    - support guide
- task detail lane:
  - `src/usecases/journey/taskDetailSectionReply.js`
  - supports manual/failure section paging
- task flex surface:
  - `src/usecases/tasks/renderTaskFlexMessage.js`
  - already exposes why-now, duration, checklist, understanding buttons
- rich menu assignment:
  - `src/usecases/journey/applyPersonalizedRichMenu.js`
  - `src/usecases/journey/applyRichMenuAssignment.js`
- data model:
  - `docs/DATA_MAP.md` shows `journey_todo_items`, `rich_menu_templates`, `rich_menu_assignment_rules`, `rich_menu_bindings`

### Missing direct observation

- workbook sheet-level IA and action map were not observed because the workbook was missing.
- therefore, menu wording / exact slot naming below is provisional architecture, not workbook-verified copy.

## Strategic direction

Treat Rich Menu as the persistent navigation shell of Task OS.

### Persistent entry families

1. `今やる`
2. `今週の期限`
3. `書類`
4. `地域手続き`
5. `人に相談`

These are navigation intents, not raw URLs.

## Chat vs LIFF vs MINI App split

### Keep in chat

- short provisional answer
- next best action
- due / blocker visibility
- one clarifying question
- simple todo state changes

### Move to LIFF

- structured fact intake
- document upload or form-like submission
- sensitive or multi-slot clarification

### Move to MINI App

- persistent workflow continuation
- stateful review
- status board / checklist / progress tracking

## Task visibility design

The assistant lane should project, at minimum:

- one primary actionable task
- due class
- blocker state
- required docs summary
- official links for the active task

It should not dump the full todo list every turn.

## Rich Menu sync rule

Per turn:

1. assistant computes `menu_entry_binding`
2. Rich Menu bridge maps that binding to an existing persistent nav family
3. if the existing menu already matches, do nothing
4. if a phase/plan shift requires a different menu, use existing assignment flow

## Exception handling

| blocker state | expected response behavior |
| --- | --- |
| missing fact | answer first, then one clarify question |
| locked task | show blocker and unblock action |
| missing docs | surface required docs + official link |
| sensitive flow | hand off to LIFF or MINI App |
| no healthy link | show internal task path and note external link unavailable |

## Phase1 rule

Do not redesign the whole task engine.  
Phase1 only creates the projection layer that makes existing task state visible in normal assistant responses.

