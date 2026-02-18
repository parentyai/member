# PHASE248_PLAN

## Purpose
- 監査 payload を規制構造で統一し、taxonomy と legal snapshot を FAQ/Ops/NextAction で共通化する。

## Scope IN
- `blockedReasonCategory` mapper 共通化
- `regulatoryProfile` を監査 payloadSummary に add-only 追加
- phase248 テスト追加

## Scope OUT
- audit_logs スキーマの破壊変更

## Acceptance / Done
- FAQ/Ops/NextAction 監査に regulatoryProfile が含まれる
- taxonomy が usecase 間で一貫
- `node --test tests/phase248/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS

## Verification
- `node --test tests/phase248/*.test.js`
- `npm run test:docs`
- `npm test`
