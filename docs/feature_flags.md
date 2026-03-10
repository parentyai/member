# V1 Feature Flag Matrix

| Flag | Default | Canary | Rollback |
| --- | --- | --- | --- |
| ENABLE_V1_CHANNEL_EDGE | false | true | false |
| ENABLE_V1_FAST_SLOW_DISPATCH | false | true | false |
| ENABLE_V1_LIFF_SYNTHETIC_EVENTS | false | true | false |
| ENABLE_V1_OPENAI_RESPONSES | false | true | false |
| ENABLE_V1_SEMANTIC_OBJECT_STRICT | false | true | false |
| ENABLE_V1_MEMORY_FABRIC | false | true | false |
| ENABLE_V1_ACTION_GATEWAY | false | true | false |
| ENABLE_V1_LINE_RENDERER | false | true | false |
| ENABLE_V1_EVIDENCE_LEDGER | false | true | false |
| ENABLE_V1_REPLAY_GATES | false | true | false |

## Non-flag release contract
- `llm:spec-contract:freeze:check` is a non-flag mandatory gate.
- This gate has no runtime rollback toggle; rollback is performed by reverting registry/script changes.
