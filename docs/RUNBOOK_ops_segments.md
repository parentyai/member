# RUNBOOK_ops_segments

## Purpose
Saved segments を登録し、plan/execute で再利用できる状態を作る。

## Steps
1. `POST /api/phase77/segments` で segmentKey/label/filter を作成する。
2. `GET /api/phase77/segments?status=active` で一覧を確認する。
3. ops_readonly の Saved Segments を選択し、filter が自動反映されることを確認する。
4. plan/execute の payload に segmentKey + filterSnapshot が含まれることを確認する。

## Notes
- `filter` は `segmentQuery` と同じキーを保存できる（例: `readinessStatus`, `needsAttention`, `hasMemberNumber`, `ridacStatus`, `limit`）。

## Rollback
- 実装PRを revert する。
