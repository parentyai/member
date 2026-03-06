# Evidence: US Journey UX-Max UI Diff (Read-only)

- retrieval date: 2026-03-06
- baseline commit: `d29727bd80c6914a1fab8c8ce9d5169c4df37ed7`
- branch: `codex/us-journey-uxmax-USJXMAX-01`

## Commands (read-only)

```bash
git show d29727bd80c6914a1fab8c8ce9d5169c4df37ed7:apps/admin/app.html | nl -ba | sed -n '616,632p'
nl -ba apps/admin/app.html | sed -n '616,632p'
git show d29727bd80c6914a1fab8c8ce9d5169c4df37ed7:apps/admin/app.html | nl -ba | sed -n '3558,3602p'
nl -ba apps/admin/app.html | sed -n '3558,3602p'
```

## Before / After: Journey KPI panel

- before (baseline):
  - includes `dashboard-journey-next-action-rate`
  - no IDs for `next-action-72h` / `blocker-resolution-hours` / `local-open-rate` / `notification-fatigue`
- after (working tree):
  - added:
    - `dashboard-journey-next-action-72h`
    - `dashboard-journey-blocker-resolution-hours`
    - `dashboard-journey-local-open-rate`
    - `dashboard-journey-notification-fatigue`

## Before / After: Users summary columns

- before (baseline):
  - no `data-users-column-toggle="localGuidanceCoverage"`
  - no `data-users-sort-key="localGuidanceCoverage"`
- after (working tree):
  - added `localGuidanceCoverage` in:
    - column toggle area
    - table header sort button

## Integrity note

- evidence source is repository state only (no generated screenshot editing).
- all checks above are read-only observations of baseline vs working tree.
