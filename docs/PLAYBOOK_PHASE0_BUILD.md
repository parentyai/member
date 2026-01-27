# Playbook Phase0 Build

Linked Task: P0-006, P0-121

## Prerequisites
- Node.js 20.x (matches GitHub Actions)
- Required ENV keys: see `.env.example`

## ENV Setup
1) Copy `.env.example` to `.env`.
2) Fill required secrets (LINE, Firestore, Storage, Base URL).
3) If running only tests, ENV values may be empty strings (tests do not read ENV).

## Install
- If `package-lock.json` exists: `npm ci`
- Otherwise: `npm install`
- Expected: dependencies installed, no errors.

## Local Start
- Run: `npm run start`
- Expected:
  - `http://localhost:8080/` returns `ok`
  - `http://localhost:8080/healthz` returns `{"ok":true,"env":"local"}` (or `ENV_NAME`)

## Tests
- Run: `npm test`
- Expected: `phase0 smoke` passes.

## Seed (Phase0)
- Run: `node scripts/seed_phase0.js`
- Expected: outputs `P0-014 seed stub: no-op` and exits 0.

## LINE Connectivity (Phase0)
Precondition: `/webhook/line` exists and LINE signature verification is enabled.

When available:
1) Get webhook service URL:
   - `WEBHOOK_URL=$(gcloud run services describe "member-webhook" --region "$GCP_REGION" --project "$GCP_PROJECT_ID" --format "value(status.url)")`
2) Set LINE webhook URL to `${WEBHOOK_URL}/webhook/line` (current: `https://member-webhook-pvxgenwkba-ue.a.run.app/webhook/line`).
3) Health check:
   - `curl -sS "${WEBHOOK_URL}/healthz"` should return JSON `{ "ok": true, "env": ... }`
   - If `404`, try `curl -sS "${WEBHOOK_URL}/healthz/"` (GFE may intercept `/healthz`)
4) Signature rejection:
   - `curl -i -X POST "${WEBHOOK_URL}/webhook/line" -d '{}'` returns `401`
5) Send a test event from LINE Developer Console.
6) Confirm 200 response and (when implemented) user creation in Firestore.

Expected:
- Webhook returns 200 for valid LINE signature.
- Webhook rejects unsigned requests (401).
- `users/{lineUserId}` is created.
