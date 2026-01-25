# Playbook Phase0 E2E

Linked Task: P0-006

## Goal
Validate admin -> test send -> mini app -> click tracking flow end-to-end.

## Steps (Skeleton)
1) Open admin `/notifications/new`.
2) Create notification with scenario/step, CTA=1, Link Registry selection.
3) Use Test Send to a known LINE user.
4) Open mini app `/inbox` and confirm notification shows.
5) Click CTA and confirm redirect + click tracking.

## Expected Results
- Delivery record created for test user.
- Notification appears in inbox.
- Click event recorded and redirects to official link.

## Notes
- TODO: add exact URLs, commands, and sample IDs.

