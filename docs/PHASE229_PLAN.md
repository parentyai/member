# PHASE229_PLAN

## 目的
- FAQ KB ガバナンスを強化し、`validUntil` / `allowedIntents` / `riskLevel=high` 問い合わせ導線必須を fail-closed で固定する。

## Scope IN
- `faq_articles` 検索対象を `status=active` + `validUntil > now` + `allowedIntents` 条件へ拡張
- high risk 記事の citation 要件（問い合わせ導線 sourceId 必須）を FAQ usecase に追加
- LLM FAQ 入力 allow-list に KBメタ情報を add-only 追加
- docs とテスト追加

## Scope OUT
- embedding 検索
- BLOCK UX の画面実装
- Ops/NextAction 出力テンプレ変更

## Target Files
- `src/repos/firestore/faqArticlesRepo.js`
- `src/usecases/faq/answerFaqFromKb.js`
- `docs/LLM_KB_SPEC.md`
- `docs/LLM_DB_INTEGRATION_SPEC.md`
- `docs/LLM_API_SPEC.md`
- `docs/LLM_DATA_MINIMIZATION.md`
- `tests/phase229/phase229_faq_repo_filters_valid_until_and_intent.test.js`
- `tests/phase229/phase229_faq_high_risk_contact_source_required.test.js`
- `docs/PHASE229_EXECUTION_LOG.md`

## Acceptance / Done
- 期限切れ KB 記事は FAQ 検索結果から除外される
- `allowedIntents` が FAQ 非許可の記事は FAQ 検索結果から除外される
- high risk 記事で問い合わせ導線 citation が不足した回答は `contact_source_required` で 422 BLOCK される
- `node --test tests/phase229/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase229/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE229_EXECUTION_LOG.md`

