# Playbook Phase0 E2E

Linked Task: P0-006, P0-121

## Goal
Validate admin -> test send flow end-to-end. Mini app was removed in Phase14 and is out of scope.

## Preconditions
- Admin API and UI implemented (P0-104).
- Kill Switch is OFF.
- Link Registry has at least one `OK` link.

## Variables
- `ADMIN_BASE_URL`: https://member-pvxgenwkba-ue.a.run.app/admin
- `TEST_LINE_USER_ID`: a LINE user ID that can receive test pushes

## Steps
1) Open `https://member-pvxgenwkba-ue.a.run.app/admin/notifications/new`.
2) Create a notification:
   - Scenario: A
   - Step: 3mo
   - Title/Body/CTA: any SSOT-conform text
   - Link: select an `OK` Link Registry entry
3) Use Test Send for `TEST_LINE_USER_ID`.
4) Mini app steps are removed (withdrawn in Phase14).

## Expected Results
- A `notification_deliveries` record is created for the test user.
Mini app verification is out of scope (withdrawn in Phase14).

## Evidence to Capture
- Notification ID
- Delivery ID
- Screenshot or logs from admin history
