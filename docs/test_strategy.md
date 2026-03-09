# Test Strategy (V1)

## Contract
- semantic response schema strict parse
- response contract compatibility adapter

## LINE constraints
- max message objects = 5
- UTF-16 text budget
- webhook dedupe/redelivery/ordering guard
- LIFF silent synthetic event normalization

## Replay
- `node tools/replay/v1/run_replay.js`

## LLM Quality Framework
- `npm run llm:quality:baseline`
- `npm run llm:quality:candidate`
- `npm run llm:quality:diff`
- `npm run llm:quality:gate`
- `npm run llm:quality:must-pass`
- `npm run llm:quality:release-policy`
