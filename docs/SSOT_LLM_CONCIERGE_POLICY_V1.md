# SSOT_LLM_CONCIERGE_POLICY_V1

## Purpose
LLMコンシェルジュの出力を「根拠付き・注入耐性・可監査」で固定する。
本仕様は add-only で運用し、既存LLM契約を破壊しない。

## Rules

### Mode定義
- Mode A（general）
  - 一般整理/手順/比較。
  - 原則 URL を提示しない。
- Mode B（evidence_required）
  - 制度/期限/法務/医療/学校/料金/規制。
  - 根拠は R0/R1 のみ。
  - URL提示上限: 有料 3、無料 1（状況により 0）。
- Mode C（suggestion）
  - 週末/旅行/アクティビティ提案。
  - 根拠は R0/R1/R2（R3は禁止）。
  - URL提示上限: 有料 3、無料 1（保存済みのみ）。

### Topic分類
- `general`, `regulation`, `medical`, `visa`, `tax`, `school`, `pricing`, `activity`, `other`
- `regulation/medical/visa/tax/school/pricing => Mode B`
- `activity => Mode C`
- それ以外は `Mode A`

### Free / Paid Policy
- Free:
  - 参照元は CityPack/FAQ の保存済みURLのみ。
  - 外部web候補は採用しない（fail-closed）。
  - URL上限: `A=0, B<=1, C<=1`。
- Paid:
  - 保存済みURL + 必要時のみ外部web候補。
  - URL上限: `A=0, B<=3, C<=3`。

### URL表示形式
- 最大3件（全モード共通上限）。
- 本文末尾に短い脚注として表示する。
- 形式: `(source: domain/path)`
- リンク羅列や本文中の直URL列挙は禁止。

### URL不要時の扱い
- URL不要時は提示しない。
- Mode A は常時 URL なし。

### 不確実時の返し方
- 「断定しない」「確認が必要」を明示する。
- 取得不能/確認不能の候補は根拠に採用しない。

## Exceptions
- `system_flags.phase0.llmConciergeEnabled=false` のとき、コンシェルジュ拡張を停止し通常安全応答へフォールバックする。
- web検索provider未設定/障害時は fail-closed（候補0件）で継続する。
- R3判定/denylist/短縮URL/疑わしいTLDは常時拒否する。

## Audit Keys
- `topic`
- `mode`
- `userTier`
- `citationRanks[]`
- `urlCount`
- `urls[]` (`rank`, `domain`, `path`, `allowed`, `reason`, `source`)
- `guardDecisions[]`
- `blockedReasons[]`
- `injectionFindings`
