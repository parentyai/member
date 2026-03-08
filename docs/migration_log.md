# Migration Log (V1 Cutover)

## Step order
1. Deploy with all `ENABLE_V1_*` flags = `false`.
2. Enable `ENABLE_V1_OPENAI_RESPONSES` in stg.
3. Enable `ENABLE_V1_LINE_RENDERER` in stg and verify 5-object/UTF-16 behavior.
4. Enable `ENABLE_V1_CHANNEL_EDGE` and verify dedupe/redelivery/order filters.
5. Enable `ENABLE_V1_LIFF_SYNTHETIC_EVENTS` and verify synthetic event writes.
6. Enable memory/action/evidence flags in stg.

## Backfill
- `node tools/migrations/v1/migrate_memory_fabric.js --dry-run`
- `node tools/migrations/v1/backfill_delivery_records.js --dry-run`
- `node tools/migrations/v1/backfill_synthetic_liff_events.js --dry-run`

## Rollback
`tools/migrations/v1/rollback_v1.sh` output values to env and redeploy.
