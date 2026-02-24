# PHASE101_108_PLAN

## Purpose
Ops Assist の表示/提案入力/安全ガード/採用フローを SSOT 化し、Ops Console 上で「提案→採用→submit→監査」までを迷わず回せる状態にする。

## Scope In
- Ops Assist suggestion payload の add-only 拡張（suggestion/evidence/safety）
- 提案入力の固定（promptVersion + 抽出キー）
- ルールベース安全ガード（NOT_READY/矛盾/allowedNextActions）
- 監査ログの標準化（LLM_SUGGESTION / LLM_SUGGESTION_ADOPTED）
- ops_readonly.html への提案表示 + Use Suggestion 導線
- LLM disabled by default の明文化
- 統合テスト（提案→採用→監査）

## Scope Out
- LINEアプリ案（LIFF/ミニアプリ/新UI）
- 自動決定/自動送信
- 既存APIの意味変更

## Tasks
- T101: Suggestion 表示スキーマ追加
- T102: ops assist input SSOT 固定（promptVersion）
- T103: Safety guard 追加（LLM前）
- T104: suggestion audit 標準化
- T105: suggestion adopt audit 導線
- T106: LLM disabled by default 固定
- T107: docs 整備
- T108: 提案→採用→監査 統合テスト

## Done Definition
- Ops Console detail に suggestion/evidence/safety が出る
- 提案入力のキーが固定されている
- safety guard が deterministic
- audit が OK/BLOCK 両方で記録される
- LLM disabled by default が担保される
- npm test PASS

## Non-Modification
- Phase25/26/27/28/40/45/51 の既存API/キーは add-only

## Rollback
- revert 実装PR
