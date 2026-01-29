# Data Model Phase2 (Read Models)

## phase2_runs/{runId}
- runId (PK)
- targetDate (YYYY-MM-DD)
- dryRun (boolean)
- status ('success'|'failed')
- counts { eventsProcessed, dailyReports, weeklyReports, checklistReports, skipped }
- durationMs
- createdAt
- finishedAt

## phase2_reports_daily_events/{date}__{scenario}
- date (YYYY-MM-DD)
- scenario
- counts { open, click, complete }
- lastRunId
- updatedAt

## phase2_reports_weekly_events/{weekStart}__{scenario}
- weekStart (YYYY-MM-DD, Monday)
- scenario
- counts { open, click, complete }
- lastRunId
- updatedAt

## phase2_reports_checklist_pending/{date}__{scenario}__{step}
- date (YYYY-MM-DD)
- scenario
- step
- totalTargets (usersInScenario * itemsInChecklist)
- completedCount
- pendingCount
- lastRunId
- updatedAt

## 参照する既存コレクション
- events (append-only)
- users
- checklists
- user_checklists
