# PHASE351_EXECUTION_LOG

## 実施内容
- `/api/admin/os/dashboard/kpi` に fallbackMode ノブを add-only で追加。
- `block` 時は full-scan fallback を実行せず `NOT AVAILABLE` を返す契約を追加。

## 検証コマンド
- `node --test tests/phase351/*.test.js`
- `npm run test:docs`
- `npm test`

## 結果
- PASS（ローカル検証）
