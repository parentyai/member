# PHASE233_PLAN

## 目的
- Ops説明とNextActionの返却を固定テンプレ化し、運用側が同じ情報順序で読めるようにする。

## Scope IN
- `getOpsExplanation` に固定テンプレ `opsTemplate` を add-only 追加
- `getNextActionCandidates` に固定テンプレ `nextActionTemplate` を add-only 追加
- NextAction候補の返却キーを `action/reason/confidence/safety` に正規化
- docs更新（API/spec/prompt）
- phase233 テスト追加

## Scope OUT
- 新しい action enum 追加
- 自動実行導線
- FAQロジック変更

## Target Files
- `src/usecases/phaseLLM2/getOpsExplanation.js`
- `src/usecases/phaseLLM3/getNextActionCandidates.js`
- `docs/LLM_API_SPEC.md`
- `docs/LLM_DB_INTEGRATION_SPEC.md`
- `docs/LLM_PROMPT_SPEC.md`
- `tests/phase233/phase233_ops_template_sections_present.test.js`
- `tests/phase233/phase233_next_actions_max3_abstract_only.test.js`
- `docs/PHASE233_EXECUTION_LOG.md`

## Acceptance / Done
- Ops説明レスポンスに `opsTemplate` が常在
- NextActionレスポンスに `nextActionTemplate` が常在
- NextAction候補の返却キーが契約キーのみ
- `node --test tests/phase233/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase233/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE233_EXECUTION_LOG.md`
