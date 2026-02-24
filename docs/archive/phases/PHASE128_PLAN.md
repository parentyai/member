# PHASE128_PLAN

## Purpose
Ops のユーザー一覧を「上から見ればいい」順に固定し、同じ入力→同じ順序を保証する（UI側では並び替えない）。

## Scope In
- `src/usecases/phase5/getUsersSummaryFiltered.js` で安定ソートを適用（Firestore orderBy に依存しない）
- ソート仕様を docs に固定（本ファイル）

## Sort Spec (SSOT)
以下の順で必ず優先して並べる（上に来るほど優先）。

1. `needsAttention === true`
2. `readiness.status === "NOT_READY"`
3. `opsState.nextAction !== "NO_ACTION"`
4. `stale === true`
5. `lastActionAt` 降順（null は最後）
6. `lineUserId` 昇順（完全安定化）

## Scope Out
- Firestore query の意味変更
- UI側での再ソート
- LLM / 自動優先度導入
- 既存APIキーの意味変更

## Done Definition
- ソート順が code / test / docs で一致
- `npm test` PASS

## Rollback
- revert 実装PR

