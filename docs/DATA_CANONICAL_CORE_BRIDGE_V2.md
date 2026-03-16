# DATA_CANONICAL_CORE_BRIDGE_V2

## Purpose
- `DATA-C-01` の observable scope として、Firestore 書き込み時に `canonical_core_outbox` へ dual-write し、repo-backed domain の PostgreSQL sidecar 入力を固定する。
- 既存 read path は変更しない（add-only）。

## Runtime Flags
- `ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1`
  - default: `false`
  - `true` のとき `source_refs` / `source_evidence` / `faq_articles` / `step_rules` 更新で `canonical_core_outbox` にイベントを書き込む。
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
- `ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1`
  - default: `false`
  - `true` のとき generic `canonical_core_objects` upsert 後に typed table materializer を実行する。
- `ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1`
  - default: `false`
  - `true` のとき typed materialization 失敗を job error として扱う（非strict時は skipped 集計で継続）。

## Event Contract (canonical_core_outbox)
- `contractVersion`: default `canonical_core_outbox_v2`
- `objectType`: `source_registry | source_snapshot | evidence_claim | knowledge_object | task_template | rule_set | exception_playbook | generated_view | ...`
- `objectId`
- `eventType`: `upsert | delete | status_change`
- `sourceSystem`
- `sourceSnapshotRef`
- `effectiveFrom`, `effectiveTo`
- `authorityTier`, `bindingLevel`, `jurisdiction`
- `payloadSummary` (lifecycle/status/risk/locale)
- `canonicalPayload` (typed PostgreSQL materializer 向けの add-only canonical payload)
- `sourceLinks[]` (`sourceId`, `snapshotRef`, `linkRole`, `primary`)
- `materializationHints.targetTables[]`（将来の typed sink で使う目的 table hint）
- `recordEnvelope`
- `sinkStatus` (`pending`)

## Foundation V2 Scope
- 既存 sink の `canonical_core_objects` upsert SQL はこの段階では変更しない。
- V2 で追加するのは outbox payload の add-only field のみで、既存 consumer は未参照のまま互換維持する。
- `source_refs` / `source_evidence` / `faq_articles` の既存 dual-write は継続し、`step_rules` は add-only で `task_template` + `rule_set` の typed payload を emit する。
- `city_packs` は add-only で `generated_view` sidecar payload を emit する。typed materializer は `metadata.countryCode` が埋まる pack のみ `generated_view` table へ materialize し、country 未解決の pack は skip reason を残して継続する。
- typed materializer の現スコープは `source_registry / source_snapshot / evidence_claim / knowledge_object / task_template / rule_set / generated_view`。
- `task_template` / `rule_set` の runtime authority は引き続き Firestore `step_rules` 側にあり、PostgreSQL typed table は compat sidecar として扱う。
- `journey_templates` / `task_contents` はこの段階では未materializeのまま残す。
- `exception_playbook` は `objectType` allowlist に残すが、repo-backed runtime authority が未観測のため current scope には含めない。
- typed row は Firestore read model の互換 sidecar として生成し、runtime authority は引き続き Firestore 側に置く。

## Deferred Scope
- `exception_playbook`
  - 現時点では src/runtime authority が未観測。
  - spec 側の要求は保持するが、Canonical Core sidecar への昇格は runtime surface と contract tests が揃ってから行う。

## Sync Job Contract
- endpoint: `POST /internal/jobs/canonical-core-outbox-sync`
- auth: `x-city-pack-job-token`（`CITY_PACK_JOB_TOKEN`）
- payload:
  - `dryRun` (bool, default false)
  - `limit` (1..500, default 100)
  - `traceId` / `requestId` (optional)
- response summary:
  - `ok`, `scannedCount`, `syncedCount`, `skippedCount`, `failedCount`
  - `typedMaterializedCount`, `typedSkippedCount`
  - `skippedReasonCounts`
  - `items[]`（event単位 outcome）

## Rollout
1. stg: `ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1=true`, `STRICT=false`
2. outbox write rate/失敗率観測
3. stg canary: `ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1=true` + sync job `dryRun=false`
4. typed canary: `ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1=true`, `STRICT=false`
5. sync failure率 / `canonicalRecordId` 付与率 / `typedMaterializedCount` を観測
6. 問題がなければ `ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1=true` を段階 ON
7. typed sidecar も安定後に `ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1=true` を段階 ON

## Rollback
1. 即時停止: `ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1=false`
2. 厳格停止解除: `ENABLE_CANONICAL_CORE_OUTBOX_STRICT_V1=false`
3. sink停止: `ENABLE_CANONICAL_CORE_POSTGRES_SINK_V1=false`
4. sink strict解除: `ENABLE_CANONICAL_CORE_POSTGRES_SINK_STRICT_V1=false`
5. typed materializer停止: `ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1=false`
6. typed strict解除: `ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1=false`
7. 完全巻き戻し: 該当PR revert
