# Phase6 Plan (Prepare)

## Primary Goal (Yes/No)
- Yes: Phase6 は SSOT で定義された範囲を最小実装し、証跡を固定する。

## In-Scope / Out-of-Scope (Yes/No)
### API
- In-Scope: Yes（SSOT_PHASE6.md に明記された API のみ）
- Out-of-Scope: Yes（SSOT に未記載の API 追加/変更）

### UI
- In-Scope: Yes（SSOT_PHASE6.md に明記された UI のみ）
- Out-of-Scope: Yes（SSOT に未記載の UI 追加/変更）

### Ops
- In-Scope: Yes（人間判断の補助のみ）
- Out-of-Scope: Yes（自動判断/自動通知/最適化）

### Data
- In-Scope: Yes（既存コレクションの非破壊 read/write のみ）
- Out-of-Scope: Yes（新規コレクション追加/破壊的変更）

## 成果物一覧（files）
- docs/SSOT_PHASE6.md
- docs/ARCHITECTURE_PHASE6.md
- docs/ACCEPTANCE_PHASE6.md
- docs/TODO_PHASE6.md
- docs/GUARDRAILS_PHASE6.md
- docs/PHASE6_PLAN.md
- Phase6 Evidence 更新（docs/TODO_PHASE6.md, docs/ACCEPTANCE_PHASE6.md）
- Implementation files: UNKNOWN（SSOT_PHASE6.md で確定）

## Phase6 CLOSE 判定条件（Evidence ベース）
- TODO_PHASE6.md の Done が Evidence 付きで埋まっている
- ACCEPTANCE_PHASE6.md の Evidence Log に UNKNOWN がない
- Phase6 タスクで定義された tests が全て PASS
- entrypoint は src/index.js のみ（増殖なし）

## 進め方
- 1 PR = 1 Task ID
- Evidence は PR / コマンド結果 / 日付を記載
- レビュー観点: 境界の明記 / 推測排除 / docs-only

## 失敗時の切り戻し
- docs-only PR は revert のみ
- 実装PRが混入した場合は即停止・差し戻し
