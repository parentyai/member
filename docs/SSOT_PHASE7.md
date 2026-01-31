# Phase7 SSOT (v0.1)

## Purpose
- Phase7 は「設計スコープの固定」「人間判断ポイントの可視化」「Phase8への境界明文化」を行う。
- Phase7 で実装は行わない。

## MUST（Yes）
- Phase7で設計対象に含めるものを Yes/No/UNKNOWN で固定する。
- 人間判断が必要なポイントを一覧として固定する（判断主体は人間）。
- Phase8 への受け渡し条件を明文化する（境界のみ、実装方法は書かない）。
- Phase7 CLOSE 条件を Yes/No 判定可能な形で明記する。

## MUST NOT（Yes）
- 実装方法の記述（API/UI/DBの具体仕様）
- 自動判断・AI判断・最適化の記述
- Phase0-Phase6 の再解釈・修正
- SSOTに存在しない新規設計の追加

## Phase7で設計対象に含めるもの（Yes/No/UNKNOWN）
- 人間判断ポイント一覧: Yes
- 境界条件（Phase8へ渡す/渡さない）: Yes
- 具体的なAPI仕様: No
- UI詳細/画面遷移: No
- データスキーマ詳細: No

## Phase7で意図的に触らないもの（Yes）
- 実装コード
- API/UI/DB の具体仕様
- 運用自動化・通知自動化

## UNKNOWN（Phase8 持ち越し / 理由）
- 具体的な判断基準の値や閾値: UNKNOWN  
  - 理由: Phase7では判断ポイントの整理のみを対象とするため  
  - Phase8で扱う
- Phase7で設計対象に含める詳細成果物の形式: UNKNOWN  
  - 理由: 人間判断での確定が未了のため  
  - Phase8で扱う

## Human Decision Items (Required)
- Decision-1: Phase7 の具体的な設計対象一覧（UNKNOWN / Phase8で確定）
- Decision-2: Phase7 で固定する判断基準の範囲（UNKNOWN / Phase8で確定）
- Decision-3: Phase7 で残す未決定事項の扱い（UNKNOWN / Phase8で確定）

## Phase7 CLOSE Conditions (Yes/No)
- Yes: docs/SSOT_PHASE7.md が本書の形式で更新されている
- Yes: docs/ACCEPTANCE_PHASE7.md がGiven/When/Then形式で存在する
- Yes: docs/TODO_PHASE7.md がBacklogのみで存在する
- Yes: Human Decision Items が Yes/No/UNKNOWN で埋められている
