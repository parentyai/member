# SSOT_PHASE7.md

## Phase
- Phase: 7
- Task: P7-001
- Type: Docs-only
- Status: COMPLETE

---

## 変更要約（3行以内）
- Phase7 の設計スコープを MUST / MUST NOT / UNKNOWN で明確化  
- UNKNOWN は理由を明示し、Phase8 へ持ち越し対象として固定  
- CLOSE 条件を Yes / No 判定可能な形式に再整理  

---

## Phase7 の位置づけ
Phase7 は **「設計フェーズ」**であり、  
実装・仕様確定・自動判断は一切行わない。

---

## Phase7 設計対象（MUST）
- 設計対象／非対象の境界定義
- 人間判断が必要な項目の洗い出しと分類
- Phase7 CLOSE 条件の定義（Yes / No 判定可能）

---

## Phase7 非対象（MUST NOT）
- 実装方法の検討
- API / UI / DB の具体仕様
- 自動判断・AI判断ロジック
- 既存 Phase（0–6）の変更

---

## 未確定事項（UNKNOWN / Phase8 持ち越し）

### UNKNOWN とする理由
- 判断材料が Phase7 の目的を超えるため
- 実装前提・運用前提が未確定なため

### Phase8 持ち越し項目
- Phase7 の具体的設計対象一覧の詳細化
- Phase7 で固定する判断基準の定量化
- 未決定事項の最終扱い（採用 / 却下 / 実験）

---

## Phase7 CLOSE 条件（Yes / No）

| チェック項目 | 判定 |
|---|---|
| SSOT_PHASE7.md が存在する | Yes / No |
| Acceptance 定義が存在する | Yes / No |
| TODO が Phase7 範囲で整理されている | Yes / No |
| Human Decision Items が Yes / No / UNKNOWN で埋まっている | Yes / No |

→ **すべて Yes の場合、Phase7 CLOSE**

---

## Non-Goals
- 実装しない
- 仕様を確定しない
- 自動化しない
- 既存フェーズを動かさない

---

## P7-002: 人間判断フロー設計（Human Decision Flow）

### A. 判断の開始条件
- Phase7 START が宣言されていること
- Phase7 設計対象（MUST）が未確定であること

### B. 判断主体
- 判断主体は人間（Role: 運用担当 / 管理責任者）とする

### C. 判断入力
- 既存 Phase の成果物
- Phase7 SSOT / Acceptance / TODO
- 現時点で確定済みの運用方針

### D. 判断結果の型
- Yes / No / Hold / UNKNOWN のいずれか

### E. 判断結果の扱い
- Yes: Phase7 で固定する事項として確定する
- No: Phase7 では確定しない
- Hold: 判断を保留し、Phase8 持ち越しにする
- UNKNOWN: 不足理由を明記し、Phase8 持ち越しにする

### F. 次フェーズへの影響
- Yes が必要条件を満たす場合のみ Phase7 CLOSE へ進む
- UNKNOWN が残る場合は Phase8 へ持ち越す

---

## P7-002: 判断ポイント一覧（Human Decision Items）

- HD-001: Phase7 の具体的設計対象一覧を確定する
  - Role: 管理責任者
  - 判定値: UNKNOWN
  - 理由: Phase7 では詳細対象の判断基準が未確定のため
  - 持ち越し先: Phase8

- HD-002: Phase7 で固定する判断基準の範囲を確定する
  - Role: 管理責任者
  - 判定値: UNKNOWN
  - 理由: 判断基準の定量化が未確定のため
  - 持ち越し先: Phase8

- HD-003: Phase7 で残す未決定事項の扱いを確定する
  - Role: 管理責任者
  - 判定値: UNKNOWN
  - 理由: 未決定事項の分類ルールが未確定のため
  - 持ち越し先: Phase8

---

## P7-002: Phase7 CLOSE 条件との関係

- CLOSE 可能:
  - HD-001 が Yes である
  - HD-002 が Yes である
  - HD-003 が Yes である

- CLOSE 可能（UNKNOWN 残存条件）:
  - UNKNOWN が残る場合は Phase7 CLOSE 不可とする

- CLOSE 不可:
  - いずれかが No / Hold / UNKNOWN の場合

---

## P7-003: Phase8 Carry-Over Items

- CO-001: Phase7 の具体的設計対象一覧の詳細化
  - Reason: Phase7 では判断基準が未確定のため決めない
  - Phase8 条件: 判断基準の範囲が Yes/No で確定している

- CO-002: Phase7 で固定する判断基準の定量化
  - Reason: 具体的な基準値が Phase7 の目的外のため決めない
  - Phase8 条件: 判断対象の一覧が確定している

- CO-003: 未決定事項の最終扱い（採用 / 却下 / 実験）
  - Reason: 判断結果の影響範囲が未確定のため決めない
  - Phase8 条件: 判断主体と決裁範囲が確定している

---

## P7-003: Carry-Over 判定ルール
- UNKNOWN が残る場合は Phase8 持ち越しとする
- 判断主体は人間（Phase8 設計）とする

---

## P7-003: Phase7 CLOSE との関係
- 持ち越しが存在しても Phase7 CLOSE は不可とする
- CLOSE は HD-001/002/003 がすべて Yes の場合のみ可能
