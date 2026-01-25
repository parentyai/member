# Playbook Phase0 Incident

Linked Task: P0-006

## Mis-send (Wrong Target)
1) Enable Kill Switch immediately.
2) Notify admin owner and record in audit log.
3) Prepare corrected notification (do not reuse the original).

## Link Outage (WARN)
1) Mark link as WARN in Link Registry.
2) Block new sends referencing WARN links.
3) Notify content owner to fix source.

## Audit Log
- Ensure every incident action is logged with actor and timestamp.

## TODO
- Add contact list and escalation timeline.

