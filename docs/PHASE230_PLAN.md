# PHASE230_PLAN

## 目的
- FAQ 検索の信頼度判定を追加し、曖昧な候補に対する回答を `low_confidence` で fail-closed する。

## Scope IN
- `faq_articles` 検索スコアを BM25 風重み付きスコアへ更新
- FAQ usecase に `MIN_SCORE` + `TOP1_TOP2_RATIO` 判定を追加
- `low_confidence` BLOCK を API/docs に追加
- docs とテスト追加

## Scope OUT
- embedding 検索
- UI の BLOCK 表示改善
- 監査 `blockedReasonCategory` 追加

## Target Files
- `src/repos/firestore/faqArticlesRepo.js`
- `src/usecases/faq/answerFaqFromKb.js`
- `docs/LLM_KB_SPEC.md`
- `docs/LLM_DB_INTEGRATION_SPEC.md`
- `docs/LLM_API_SPEC.md`
- `docs/LLM_DATA_MINIMIZATION.md`
- `tests/phase230/phase230_faq_confidence_blocks_low_confidence.test.js`
- `tests/phase230/phase230_faq_repo_ranking_prefers_weighted_match.test.js`
- `docs/PHASE230_EXECUTION_LOG.md`

## Acceptance / Done
- FAQ 候補が閾値未満の場合、`low_confidence` で 422 BLOCK される
- FAQ 検索結果に `searchScore` が付与され、重み付き一致で順位が安定する
- `node --test tests/phase230/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS
- working tree CLEAN

## Verification
- `node --test tests/phase230/*.test.js`
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE230_EXECUTION_LOG.md`
