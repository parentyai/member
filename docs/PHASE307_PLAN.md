# PHASE307_PLAN

## Goal
構造崩壊耐性の補強（挙動不変 / add-only）を実装する。

## Scope
1. データ契約正規化（scenario/scenarioKey, ops_state/ops_states）
2. canonical repo固定（重複6組）
3. missing-index fallback方針固定
4. 保護マトリクス参照化（既存挙動維持）
5. retention SSOT + dry-run internal job

## Out of Scope
- 新機能追加
- 既存エンドポイントの破壊変更
- 実削除を行う retention job
