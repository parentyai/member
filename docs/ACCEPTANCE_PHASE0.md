# Acceptance Phase0

Linked Task: P0-007, P0-121

## Acceptance Checklist (YES/NO)

Note:
- LINE webhook requires unauthenticated access. Org policy exception must allow `allUsers` for Cloud Run invoker on `member-webhook`.

### A. LINE
- [ ] LINE push send to a specific user works.
- [ ] Webhook receives events and stores LINE userId.
- [ ] Rich menu 4 slots link to mini app/external URLs.
- [ ] First-time welcome message sent exactly once.

### B. Mini App (Minimum)
- [ ] Auto-identification by LINE userId (no ID/pass).
- [ ] Inbox screen shows notifications with read/unread.
- [ ] Checklist screen shows 3-5 items by scenario/step.
- [ ] Each item has exactly one CTA and records click.

### C. Admin
- [ ] Create notification (title/body/CTA/link).
- [ ] Select scenario/step (A or C, 3mo/1mo/week/after1w).
- [ ] Targeting supports all/region/members-only.
- [ ] Preview -> test send -> scheduled or immediate send.
- [ ] History shows delivered/read/click counts.
- [ ] Kill Switch works (admin-only).
- [ ] Audit log records all actions.

### D. Safety
- [ ] Link missing blocks save.
- [ ] Link Registry exists with health check and WARN status.
- [ ] WARN links cannot be linked to notifications (or hard warning).
- [ ] Audit logs are immutable.

### E. Deploy / Access
- [ ] Cloud Run webhook edge (`member-webhook`) is reachable without auth (unauth 200 expected).

## Evidence Log
| Area | Date (YYYY-MM-DD) | Executor | Evidence link | Notes |
| --- | --- | --- | --- | --- |
| A. LINE |  |  |  |  |
| B. Mini App |  |  |  |  |
| C. Admin |  |  |  |  |
| D. Safety |  |  |  |  |
| E. Deploy / Access | 2026-01-27 | arumamihsnob | https://github.com/parentyai/member/actions/runs/21380967358 | member: `https://member-pvxgenwkba-ue.a.run.app` / webhook: `https://member-webhook-306972605843.us-east1.run.app` / allUsers invoker enabled |

## Sign-off
- Reviewer: 
- Date: 
- Result: PASS / FAIL
