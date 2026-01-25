# Playbook Phase0 E2E

Linked Task: P0-006, P0-121

## Goal
Validate admin -> test send -> mini app -> click tracking flow end-to-end.

## Preconditions
- Admin API and UI implemented (P0-104).
- Mini app inbox/checklist implemented (P0-107).
- Click tracking implemented (P0-108).
- Kill Switch is OFF.
- Link Registry has at least one `OK` link.

## Variables
- `ADMIN_BASE_URL`: admin UI base (example: https://<service-url>/admin)
- `MINIAPP_BASE_URL`: mini app base (example: https://<service-url>)
- `TEST_LINE_USER_ID`: a LINE user ID that can receive test pushes

## Steps
1) Open `${ADMIN_BASE_URL}/notifications/new`.
2) Create a notification:
   - Scenario: A
   - Step: 3mo
   - Title/Body/CTA: any SSOT-conform text
   - Link: select an `OK` Link Registry entry
3) Use Test Send for `TEST_LINE_USER_ID`.
4) Open `${MINIAPP_BASE_URL}/inbox` and confirm the notification appears.
5) Click the CTA.

## Expected Results
- A `notification_deliveries` record is created for the test user.
- Notification appears in inbox as unread then read after opening.
- Click event recorded and redirected to the official link.

## Evidence to Capture
- Notification ID
- Delivery ID
- Click timestamp
- Screenshot or logs from admin history

