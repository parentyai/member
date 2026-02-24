# SEED_SETUP_RUNBOOK

## Purpose
- Seed notification templates and city packs without creating user dummy records.
- Keep all seeded docs reversible by `seedRunId` via `seed_runs/{seedRunId}` manifest targets.

## Scope
- Write collections: `notifications`, `link_registry`, `source_refs`, `city_packs`, `seed_runs`.
- Never writes: user collections such as `users`, `user_checklists`.

## Safety guards
- `ENV_NAME=prod` or `ENV_NAME=production` blocks both setup and purge.
- Purge requires `--confirm SEED_DELETE`.
- All seeded docs include:

```json
{
  "seed": {
    "isSeed": true,
    "seedRunId": "<seedRunId>",
    "seedKind": "<kind>",
    "envName": "<envName>"
  }
}
```

## Setup command

```bash
node tools/seed_templates_and_citypacks.js --dry-run
node tools/seed_templates_and_citypacks.js --seedRunId member_seed_20260223 --kind demo
node tools/seed_templates_and_citypacks.js --templatesOnly --dry-run
node tools/seed_templates_and_citypacks.js --cityPacksOnly --dry-run
```

`npm` shortcuts:

```bash
npm run seed:setup
```

Expected stdout shape:

```json
{
  "ok": true,
  "seedRunId": "member_seed_20260223",
  "created": {
    "templates": 22,
    "cityPacks": 12,
    "links": 12,
    "sourceRefs": 12
  },
  "dryRun": false
}
```

## Purge command

```bash
node tools/seed_purge.js --seedRunId member_seed_20260223 --confirm SEED_DELETE --dry-run
node tools/seed_purge.js --seedRunId member_seed_20260223 --confirm SEED_DELETE
```

`npm` shortcut:

```bash
SEED_RUN_ID=member_seed_20260223 npm run seed:purge
```

Purge behavior:
- Reads `seed_runs/{seedRunId}`.
- Deletes only `targets[]` docs listed in manifest.
- Deletes the manifest doc last.
- Does not query by filters, search, or indexes.

## Data bundle details
- Notifications (`notifications`):
1. `GENERAL` 4 docs
2. `ANNOUNCEMENT` 4 docs
3. `STEP` 8 docs (`3mo`, `1mo`, `week`, `after1w` each 2)
4. `VENDOR` 6 docs with `notificationMeta.vendorKey` and `notificationMeta.vendorId`
5. All docs are `status=draft`

- Link registry (`link_registry`):
1. 12 docs with `lastHealth.state=OK`
2. `lastHealth.statusCode` and `lastHealth.checkedAt` are set

- City packs (`city_packs`):
1. 12 docs for `nyc`, `westchester`, `long-island`, `northern-nj`, `boston`, `la`, `sf`, `sj`, `detroit`, `chicago`, `houston`, `dallas`
2. All docs are `status=draft`
3. Each doc includes `sourceRefs` and `metadata.sources` / `metadata.notes`

- Source refs (`source_refs`):
1. 12 docs, one per city pack

- Manifest (`seed_runs`):
1. `seedRunId`, `seedKind`, `envName`, `createdAt`, `targets[]`, `summary`

## Common failures
- `seed setup/purge is blocked when ENV_NAME is prod or production`
  - Cause: `ENV_NAME` is `prod` or `production`.
  - Action: switch to non-production env.

- `purge requires --confirm SEED_DELETE`
  - Cause: missing or invalid `--confirm` token.
  - Action: rerun with `--confirm SEED_DELETE`.

- `seed run already exists: <seedRunId>`
  - Cause: duplicate run id.
  - Action: use a new `--seedRunId` or purge the existing one first.

- `target already exists: <collection>/<docId>`
  - Cause: partial prior run with same `seedRunId`.
  - Action: run purge for that run id, then run setup again.

## Rollback
1. Soft rollback (data only): run purge with matching `seedRunId`.
2. Full rollback (code): revert the PR commit and run tests again.
