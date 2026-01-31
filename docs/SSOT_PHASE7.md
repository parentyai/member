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
