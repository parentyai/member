# PHASE363_EXECUTION_LOG

## 実施内容
- load_risk 生成ロジックを runtime callsite 優先へ補正。
- fallback_risk を file/call の unique surface 集計に変更（add-only）。

## 検証コマンド
- `node --test tests/phase363/*.test.js`
- `npm run load-risk:generate`
- `npm run load-risk:check`

## 結果
- PASS（ローカル検証）
