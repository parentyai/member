# Playbook Phase0 Debug

Linked Task: P0-006

## Common Failures (Skeleton)

### LINE Webhook Signature
- Symptom: 401/403 on /webhook/line
- Cause: Invalid signature or wrong channel secret
- Fix: Verify `LINE_CHANNEL_SECRET` and signature middleware

### Permissions / Firestore
- Symptom: Permission denied on DB write
- Cause: Firestore rules or credentials missing
- Fix: Verify service account and project ID

### ENV Missing
- Symptom: App fails on startup
- Cause: Required ENV not set
- Fix: Fill `.env` based on `.env.example`

## Error Code -> Cause -> Action
- TODO: fill mapping once error codes are defined.

