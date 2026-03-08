# semantic_response_object

Schema: `/schemas/semantic_response_object.schema.json`

Required:
- `version=v1`
- `response_contract.style`
- `response_contract.intent`
- `response_contract.summary`
- `response_contract.next_steps[] <= 3`

Compatibility:
- legacy `response_markdown` is derived from semantic object at render time.
