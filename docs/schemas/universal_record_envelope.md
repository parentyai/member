# universal_record_envelope

Schema: `/schemas/universal_record_envelope.schema.json`

## Purpose
- Data integration specが要求する Universal Record Envelope をリポジトリ契約として固定する。
- retention / masking / deletion / access / audit の共通必須項目を明文化する。

## Required keys
- `record_id`
- `record_type`
- `source_system`
- `source_snapshot_ref`
- `effective_from`
- `authority_tier`
- `binding_level`
- `status`
- `created_at`
- `updated_at`

## Policy hints
- `authority_tier` は T0..T4+UNKNOWN を許可。
- `binding_level` は MANDATORY/POLICY/RECOMMENDED/REFERENCE/UNKNOWN。
- `effective_to` が null の場合は有効継続とみなす。
