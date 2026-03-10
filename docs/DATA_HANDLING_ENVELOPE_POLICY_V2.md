# DATA_HANDLING_ENVELOPE_POLICY_V2

## Scope
- 対象: `llm_* logs`, `memory_*`, `delivery_records`, `liff_synthetic_events`, `source_refs`。
- 目的: Universal Record Envelope を段階適用し、Data Integration Spec準拠の最低契約を固定する。

## Envelope adoption states
- `state=planned`: schema定義済み、writer未適用
- `state=shadow_write`: payload本体は現状維持、envelopeサブオブジェクトをadd-only保存
- `state=enforced`: writerで必須項目不足を拒否

## Current adoption snapshot
| data_class | adoption_state | writer_path |
| --- | --- | --- |
| llm_action_logs | shadow_write | `src/repos/firestore/llmActionLogsRepo.js` |
| llm_quality_logs | shadow_write | `src/repos/firestore/llmQualityLogsRepo.js` |
| faq_answer_logs | shadow_write | `src/repos/firestore/faqAnswerLogsRepo.js` |
| source_refs | shadow_write | `src/repos/firestore/sourceRefsRepo.js` |
| memory_* | shadow_write | `src/v1/memory_fabric/*` |
| delivery_records | shadow_write | `src/v1/evidence_ledger/deliveryRecordsRepo.js` |
| liff_synthetic_events | shadow_write | `src/routes/liffSyntheticEvent.js`, `src/repos/firestore/liffSyntheticEventsRepo.js` |

## Retention / deletion / masking / access / audit matrix template
| data_class | retention_tag | deletion_policy | masking_policy | access_scope | audit_required |
| --- | --- | --- | --- | --- | --- |
| llm_action_logs | llm_action_180d | soft_delete_then_purge | pii_mask_operator | operator,admin | true |
| llm_quality_logs | llm_quality_180d | soft_delete_then_purge | pii_mask_operator | operator,admin | true |
| memory_profile | profile_until_delete_or_review | user_delete_cascade | pii_mask_strict | system,operator_limited | true |
| memory_session | session_retention_policy | session_expire | pii_mask_operator | system,operator_limited | true |
| memory_task | task_end | task_complete_archive | pii_mask_operator | system,operator_limited | true |
| compliance_memory | policy_defined | policy_defined | pii_mask_strict | system,admin | true |
| delivery_records | delivery_180d | scheduled_purge | pii_mask_operator | operator,admin | true |
| liff_synthetic_events | liff_event_90d | scheduled_purge | pii_mask_operator | operator,admin | true |

## Rollout rule
1. まず `planned -> shadow_write` を適用（読み取り互換を壊さない）。
2. 監査/運用確認後に `enforced` へ昇格。
3. rollback は `enforced -> shadow_write` の順で戻す。
