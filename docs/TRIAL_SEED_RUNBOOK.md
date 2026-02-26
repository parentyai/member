# TRIAL_SEED_RUNBOOK

## Purpose
- Provision a full trial bundle for admin operational checks.
- Remove seeded records safely by manifest (`seed_runs/{seedRunId}.targets`) without search/index dependency.

## Prerequisites
- Environment variables:
  - `ENV_NAME` (must not be `prod` or `production`)
  - `FIRESTORE_PROJECT_ID` (or equivalent ADC project resolution)
- ADC login:
  - `gcloud auth application-default login`
- Access to Firestore project in target environment (`local` or `stg`).

## Safety Contracts
- `ENV_NAME=prod` or `ENV_NAME=production` blocks setup/purge immediately.
- Purge requires `--confirm SEED_DELETE`.
- `--dry-run` is supported for setup and purge.
- All seeded records include:

```json
{
  "seed": {
    "isSeed": true,
    "seedRunId": "<seedRunId>",
    "seedKind": "<seedKind>",
    "envName": "<envName>"
  }
}
```

## Setup Commands

Plan only (no write):

```bash
node tools/seed_trial_setup.js --planOnly
```

Dry run (existence checks, no write):

```bash
node tools/seed_trial_setup.js --dry-run --users 200 --templates true --cityPacks true --links true --vendors 6
```

Write execution:

```bash
node tools/seed_trial_setup.js --seedRunId trial_20260226 --kind trial --users 200
```

`npm` shortcut:

```bash
npm run seed:trial
```

Expected stdout shape:

```json
{
  "ok": true,
  "seedRunId": "trial_20260226",
  "created": {
    "users": 200,
    "notifications": 26,
    "links": 12,
    "cityPacks": 12,
    "vendors": 6,
    "checklists": 8,
    "notificationDeliveries": 200,
    "events": 267,
    "sourceRefs": 12
  },
  "dryRun": false,
  "planOnly": false
}
```

## Purge Commands

Dry run:

```bash
node tools/seed_trial_purge.js --seedRunId trial_20260226 --confirm SEED_DELETE --dry-run
```

Write execution:

```bash
node tools/seed_trial_purge.js --seedRunId trial_20260226 --confirm SEED_DELETE
```

`npm` shortcut:

```bash
SEED_RUN_ID=trial_20260226 npm run seed:purge
```

Purge behavior:
- Reads `seed_runs/{seedRunId}`.
- Deletes only manifest `targets[]`.
- Deletes `seed_runs/{seedRunId}` last.
- Never searches by field filter or composite index.

## Common Failures
- `seed setup/purge is blocked when ENV_NAME is prod or production`
  - Cause: `ENV_NAME` is `prod` or `production`.
  - Action: switch to `local`/`stg`, rerun.

- `purge requires --confirm SEED_DELETE`
  - Cause: missing/invalid confirm token.
  - Action: rerun with `--confirm SEED_DELETE`.

- `seed run already exists: <seedRunId>`
  - Cause: duplicate run id.
  - Action: use a new `--seedRunId` or purge the existing run id first.

- `target already exists: <collection>/<docId>`
  - Cause: partial previous write with same seed run id.
  - Action: purge existing run id first, then rerun with a fresh seed run id.

- Permission/auth errors
  - Cause: missing IAM or ADC session.
  - Action: run `gcloud auth application-default login`, verify project IAM, rerun.

- Validator violations (CTA/link/direct URL/WARN link)
  - Cause: modified seed payload or invalid link state.
  - Action: keep single CTA, keep `linkRegistryId`, avoid direct URL fields, keep link health non-`WARN`.

## Partial Failure and Re-run Strategy
- Setup writes `seed_runs/{seedRunId}` with `status=running` before targets.
- If target write fails, manifest is updated to `status=failed` with `failureMessage`.
- Recovery:
  1. Run purge for the failed `seedRunId`.
  2. Re-run setup with a new `seedRunId`.

## Rollback
1. Data rollback:
   - run trial purge for the affected `seedRunId`.
2. Procedure rollback:
   - switch operation back to legacy `seed:setup` + `seed_purge` workflow if required.
3. Code rollback:
   - revert the PR and re-run tests.
