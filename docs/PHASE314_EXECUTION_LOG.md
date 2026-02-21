# PHASE314_EXECUTION_LOG

## 実施内容
- retention apply に `dryRunTraceId` 照合を追加。
- `maxDeletes`/`cursor` で段階削除を追加（互換維持）。
- 監査 payload を拡張（dryRunTraceId, deleted samples）。

## 検証コマンド
- `npm run test:docs`
- `npm test`
- `node --test tests/phase314/*.test.js`

## 結果
- PASS
  - `npm run test:docs`
  - `npm test`
  - `node --test tests/phase314/*.test.js`
- 追加:
  - `tests/phase314/phase314_t01_retention_apply_dry_run_trace_contract.test.js`
  - `tests/phase314/phase314_t02_retention_apply_cursor_and_audit_contract.test.js`
