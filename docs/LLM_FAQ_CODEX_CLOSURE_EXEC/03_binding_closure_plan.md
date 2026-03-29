# Binding Closure Plan

## Executed Leaf
- `leaf_free_retrieval_empty_reply`

## Frozen Binding
- token: `<title>`
- observed source: `buildEmptyReply(question) -> normalizeText(question)`
- source path: `src/usecases/assistant/generateFreeRetrievalReply.js`
- fallback value: `ご質問`

## Implementation Shape
- add-only contract module: `src/domain/llm/closure/codexOnlyClosureContracts.js`
- exported binding record: `FREE_RETRIEVAL_EMPTY_REPLY_BINDING`
- exported resolver: `resolveFreeRetrievalEmptyReplyTitle(question)`

## Validation
- direct contract assertion for normalized question vs fallback
- runtime assertion that empty retrieval reply includes normalized `<title>` summary line

## Region Ack Note
- `leaf_region_state_ack` also involves binding (`<cityLabel>`, `<stateLabel>`) but closure pack classified it under variant closure.
- Binding was frozen only insofar as the observed render path `regionDeclared(region.regionCity, region.regionState)` is captured without changing wording.
