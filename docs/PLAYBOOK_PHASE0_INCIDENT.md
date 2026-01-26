# Playbook Phase0 Incident

Linked Task: P0-006, P0-121

## Contacts (fill before go-live)
- Incident Commander: [name, email]
- Ops Owner: [name, email]
- Product Owner: [name, email]
- Security/Compliance: [name, email]
- Content/Link Owner: [name, email]

## Mis-send (Wrong Target)
1) Enable Kill Switch immediately (admin settings).
2) Capture incident details: notification ID, target conditions, and time.
3) Notify Incident Commander and Product Owner.
4) Prepare corrected notification as a new send (do not reuse the original).
5) Record all actions in audit log.

Expected:
- Kill Switch ON blocks new sends.
- Audit log contains incident actions.

## Link Outage (WARN)
1) Mark affected link as WARN in Link Registry.
2) Block new notifications referencing WARN links.
3) Notify Content/Link Owner with the broken URL and time.
4) After fix, re-check link health and set to OK.

Expected:
- WARN links cannot be linked to new notifications.

## Unauthorized Send / Suspicious Activity
1) Enable Kill Switch.
2) Review audit log for actor/action/time.
3) Rotate LINE channel access token if compromise is suspected.
4) Notify Security/Compliance and document impact.

Expected:
- No further sends while Kill Switch ON.

## Escalation Timeline (targets)
- Acknowledge within 10 minutes.
- Kill Switch decision within 15 minutes.
- Internal status update within 1 hour.

## Post-Incident
- Record summary, root cause, and follow-up actions.
- Add SSOT delta proposal if the incident indicates a spec gap.
