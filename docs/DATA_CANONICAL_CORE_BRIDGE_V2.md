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

## Rollout
1. stg: `ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1=true`, `STRICT=false`
2. outbox write rate/失敗率観測
3. PostgreSQL sink 実装後に dual-write 先を canonical sink へ昇格
4. 問題がなければ strict を段階 ON

## Rollback
1. 即時停止: `ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1=false`
2. 厳格停止解除: `ENABLE_CANONICAL_CORE_OUTBOX_STRICT_V1=false`
3. 完全巻き戻し: 該当PR revert
