# PHASE235_EXECUTION_LOG

## ブランチ
- `codex/phase235-guide-only-faq`

## 実装内容
- FAQ usecase に guide-only ガード追加
  - `guide_only_mode_blocked`
  - `personalization_not_allowed`
- personalization allow-list: `locale|servicePhase`
- 監査 payloadSummary に `guideMode` / `personalizationKeys` 追加
- admin/compat FAQ route で新規入力キーを受け渡し
- phase235 テスト3件を追加

## 実行コマンド
- `node --test tests/phase235/*.test.js`
- `npm run test:docs`
- `npm test`

## 結果
- `node --test tests/phase235/*.test.js` PASS
- `npm run test:docs` PASS
- `npm test` PASS（634/634）
