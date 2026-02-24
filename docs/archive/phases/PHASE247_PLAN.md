# PHASE247_PLAN

## Purpose
- Ops説明テンプレの順序契約を固定し、NextAction 表示は UI 小文字化で運用可読性を上げる。

## Scope IN
- Ops template 順序契約の維持
- NextAction の UI 表示を小文字化（内部 enum は維持）
- phase247 テスト追加

## Scope OUT
- NextAction 内部 enum の破壊変更

## Acceptance / Done
- Ops template 順が固定
- UI では next action が小文字表示
- `node --test tests/phase247/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS

## Verification
- `node --test tests/phase247/*.test.js`
- `npm run test:docs`
- `npm test`
