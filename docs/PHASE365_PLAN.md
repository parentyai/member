# PHASE365_PLAN

## 目的
phase4 notifications summary の global events fallback を最小化し、scoped/range 失敗時のみ full-scan を許可する。

## スコープ
- `src/usecases/admin/getNotificationOperationalSummary.js`
- `docs/INDEX_REQUIREMENTS.md`
- `tests/phase365/*`

## 受入条件
- notification scoped + range query が優先される。
- event range が無いケースでは global fallback を実行しない。
- 既存レスポンス互換を維持する。
