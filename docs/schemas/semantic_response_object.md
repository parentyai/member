# semantic_response_object

Schema: `/schemas/semantic_response_object.schema.json`

Required:
- `version=v1`
- `contract_version`
- `intent`
- `stage`
- `answer_mode`
- `action_class`
- `confidence_band`
- `tasks[]`
- `warnings[]`
- `evidence_refs[]`
- `follow_up_questions[]`
- `memory_read_scopes[]`
- `memory_write_scopes[]`
- `handoff_state`
- `service_surface`
- `response_chunks[]`
- `response_markdown`
- `path_type`
- `u_units[]`
- `group_privacy_mode`
- `quick_replies[]`
- `policy_trace`
- `citation_summary`

Compatibility:
- legacy `response_contract` は削除せず canonical top-level から常に再構成する。
- legacy-only payload も strict parser で canonical 化し、`contract_version=sro_v2` を補完する。
- `response_markdown` は canonical から導出可能だが、runtime では top-level と legacy mirror を同時保持する。

Traceability:
- `contract_version`: canonical SRO のバージョン識別子
- `path_type`: `fast | slow | unknown`
- `u_units[]`: U-01〜U-35 の責務識別子。未分離経路は複数U番号を並記して composite として扱う
- `service_surface`: `text | quick_reply | flex | template | liff | mini_app | push | service_message`
- `group_privacy_mode`: `direct | group_safe`
