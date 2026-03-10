# DATA_CANONICAL_CORE_BRIDGE_V2

## Purpose
- `DATA-C-01` の段階移行として、Firestore 書き込み時に `canonical_core_outbox` へ dual-write し、後段 PostgreSQL Canonical Core 取り込みの入力を固定する。
- 既存 read path は変更しない（add-only）。

## Runtime Flags
- `ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1`
  - default: `false`
  - `true` のとき `source_refs` / `faq_articles` 更新で `canonical_core_outbox` にイベントを書き込む。
- `ENABLE_CANONICAL_CORE_OUTBOX_STRICT_V1`
  - default: `false`
  - `true` のとき outbox 書き込み失敗を本処理失敗として返す。
  - `false` のとき outbox 失敗は本処理を継続（best-effort）。
- `ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1`
  - default: `false`
  - `true` のとき outbox sync job が PostgreSQL `canonical_core_objects` へ upsert を試行する。
- `ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1`
  - default: `false`
  - `true` のとき PostgreSQL sink 失敗を job error として扱う（非strict時は skipped/failed 集計で継続）。

## Event Contract (canonical_core_outbox)
- `objectType`: `source_snapshot | knowledge_object | ...`
- `objectId`
- `eventType`: `upsert | delete | status_change`
- `sourceSystem`
- `sourceSnapshotRef`
- `effectiveFrom`, `effectiveTo`
- `authorityTier`, `bindingLevel`, `jurisdiction`
- `payloadSummary` (lifecycle/status/risk/locale)
- `recordEnvelope`
- `sinkStatus` (`pending`)

## Sync Job Contract
- endpoint: `POST /internal/jobs/canonical-core-outbox-sync`
- auth: `x-city-pack-job-token`（`CITY_PACK_JOB_TOKEN`）
- payload:
  - `dryRun` (bool, default false)
  - `limit` (1..500, default 100)
  - `traceId` / `requestId` (optional)
- response summary:
  - `ok`, `scannedCount`, `syncedCount`, `skippedCount`, `failedCount`
  - `skippedReasonCounts`
  - `items[]`（event単位 outcome）

## Rollout
1. stg: `ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1=true`, `STRICT=false`
2. outbox write rate/失敗率観測
3. stg canary: `ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1=true` + sync job `dryRun=false`
4. sync failure率と `canonicalRecordId` 付与率を観測
5. 問題がなければ `ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1=true` を段階 ON

## Rollback
1. 即時停止: `ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1=false`
2. 厳格停止解除: `ENABLE_CANONICAL_CORE_OUTBOX_STRICT_V1=false`
3. sink停止: `ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1=false`
4. sink strict解除: `ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1=false`
5. 完全巻き戻し: 該当PR revert
