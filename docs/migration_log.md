# Migration Log (V1 Cutover)

## Step order
1. Run `npm run llm:spec-contract:freeze:check` and keep registry hash immutable for the release window.
2. Deploy with all `ENABLE_V1_*` flags = `false` and keep `ENABLE_V1_OPENAI_RESPONSES=true` as visibility marker.
3. Verify `ENABLE_V1_OPENAI_RESPONSES=true` remains pinned in stg/prod deploy workflows (runtime is Responses-only either way).
4. Enable `ENABLE_V1_LINE_RENDERER` in stg and verify 5-object/UTF-16 behavior.
5. Enable `ENABLE_V1_CHANNEL_EDGE` and verify dedupe/redelivery/order filters.
6. Enable `ENABLE_V1_LIFF_SYNTHETIC_EVENTS` and verify synthetic event writes.
7. Enable memory/action/evidence flags in stg.

## Backfill
- `node tools/migrations/v1/migrate_memory_fabric.js --dry-run`
- `node tools/migrations/v1/backfill_delivery_records.js --dry-run`
- `node tools/migrations/v1/backfill_synthetic_liff_events.js --dry-run`
- Envelope adoption starts with `state=planned` documented in `/docs/DATA_HANDLING_ENVELOPE_POLICY_V2.md`.

## Rollback
`tools/migrations/v1/rollback_v1.sh` output values to env and redeploy.
