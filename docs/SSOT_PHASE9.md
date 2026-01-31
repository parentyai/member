# SSOT_PHASE9.md

## Purpose
- Phase9 は CO-001〜003 について「判断対象とするもの / 判断しないもの」を確定する設計フェーズである。
- 判断内容の具体化・実装検討・数値条件の確定は行わない。

## In Scope
- CO-001
- CO-002
- CO-003

## Out of Scope
- 判断内容の具体化
- 実装方法の検討
- 数値・条件の確定
- CO-001〜003 以外

## Human Decision
- Phase9 では UNKNOWN を許可する
- Phase10 での判断強制条件を設計する

## CO-002 Decision Scope (Phase9)

### IN SCOPE（判断対象）
- 判断基準の定量化が必要な対象の列挙  
  - 理由: CO-002 の目的が「定量化対象の確定」にあるため
- 定量化が不要な対象の除外  
  - 理由: 判断範囲の境界を固定するため

### OUT OF SCOPE（判断非対象）
- 定量値・閾値の決定  
  - 理由: 数値・条件の確定は Phase9 の禁止事項のため
- 算出方法や評価方式の決定  
  - 理由: 実装・方式の具体化に該当するため

### GRAY ZONE（境界ケース）
- 暫定値や仮置きの設定  
  - 扱い: OUT（数値・条件の確定に該当するため）
- 定量化対象の粒度の調整  
  - 扱い: IN（対象の列挙に含まれるため）

### Decision Principles（判断原則）
- 対象は「定量化が必要/不要」を区別できる単位で列挙する  
- 定量値・閾値・条件式には触れない  
- 対象外は明示的に除外する  
- CO-002 の範囲外には拡張しない  

## CO-001 Decision Scope (Phase9)
### MUST (Yes)
- 判断対象: Phase7 の具体的設計対象一覧の詳細化
  - 理由: CO-001 の対象だから

### MUST NOT (No)
- 実装方法の検討
  - 理由: Phase9 の禁止事項だから
- 数値・条件の確定
  - 理由: Phase9 の禁止事項だから

### DEFERRED (Phase10)
- 前提資料が不足する設計対象の詳細化項目
  - 理由: Phase9 では前提資料の充足を確定しないため

## CLOSE 条件（Yes/No）
| チェック項目 | 判定 |
|---|---|
| SSOT_PHASE9.md が存在する | Yes / No |
| TODO_PHASE9.md が存在する | Yes / No |
| ACCEPTANCE_PHASE9.md が存在する | Yes / No |
| GUARDRAILS_PHASE9.md が存在する | Yes / No |
| In Scope が CO-001〜003 のみ | Yes / No |
