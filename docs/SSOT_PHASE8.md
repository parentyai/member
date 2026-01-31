# SSOT_PHASE8.md

## Purpose
- Phase8 は Phase7 からの Carry-Over Items のみを確定する設計フェーズである。
- Phase8 は設計フェーズであり、実装を行わない。

## CO-001 (Design Fix)
### MUST
- Phase7 の具体的設計対象一覧を「詳細化」するために、Phase8で確定する
### PRECONDITION
- 判断基準の範囲が Yes/No で確定していること
### MUST NOT
- 実装方法・API/UI/DBの具体記述
- CO-001 以外の対象に言及すること
### UNDECIDED
- HD8-001: 具体的設計対象一覧の詳細化内容を確定する（UNDECIDED）
- HD8-002: 判断基準の範囲が Yes/No で確定しているか確認する（UNDECIDED）

## CO-002 (Design Fix)
### MUST
- Phase7 で固定する判断基準の定量化を Phase8 で扱う
### PRECONDITION
- 判断対象の一覧が確定していること
### MUST NOT
- 実装方法・API/UI/DBの具体記述
- CO-002 以外の対象に言及すること
### UNDECIDED
- HD8-003: 判断基準の定量化内容を確定する（UNDECIDED）
- HD8-004: 判断対象の一覧が確定しているか確認する（UNDECIDED）

## In Scope
- CO-001
- CO-002
- CO-003

## Out of Scope
- Phase7 で除外されたすべて
- 新規アイデア

## Human Decision
- 判断してよい項目: CO-001 / CO-002 / CO-003
- 判断しない項目: CO-001〜003 以外の全て

## CLOSE 条件（Yes/No）
| チェック項目 | 判定 |
|---|---|
| SSOT_PHASE8.md が存在する | Yes / No |
| TODO_PHASE8.md が存在する | Yes / No |
| ACCEPTANCE_PHASE8.md が存在する | Yes / No |
| GUARDRAILS_PHASE8.md が存在する | Yes / No |
| In Scope が CO-001〜003 のみ | Yes / No |

## UNKNOWN
- UNKNOWN を追加する場合は理由と次フェーズを必ず明記する
- 現時点: UNKNOWN なし
