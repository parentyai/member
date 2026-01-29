# TODO Phase 3 Ledger

## Backlog

## Done

### P3-001: Phase3 SSOT確定
- Purpose: Phase3 の目的/境界/非目的を確定する
- Output Files: docs/SSOT_PHASE3.md
- Acceptance: 目的/決めること/決めないこと/完了条件/未決定事項が明記されている
- Dependencies: None
- Owner: Human
- Evidence: docs/SSOT_PHASE3.md（phase3/close-design）

### P3-002: UX境界定義（Mini / Admin / 人手運用）
- Purpose: UX / 運用の責務分離を確定する
- Output Files: docs/SSOT_PHASE3.md
- Acceptance: Mini/Admin/人手運用の責務が固定されている
- Dependencies: P3-001
- Owner: Human
- Evidence: docs/SSOT_PHASE3.md（phase3/close-design）

### P3-003: 人間運用フロー確定
- Purpose: 運用手順と判断ポイントを明確化する
- Output Files: docs/SSOT_PHASE3.md
- Acceptance: Who/When/What/Decision のステップ表が明記されている
- Dependencies: P3-001
- Owner: Human
- Evidence: docs/SSOT_PHASE3.md（phase3/close-design）

### P3-004: 設計範囲の確定（構造化の対象）
- Purpose: Phase3で設計する範囲を固定する
- Output Files: docs/SSOT_PHASE3.md
- Acceptance: 画面遷移/状態/データ辞書/権限/監査/テンプレ/リスクが明記されている
- Dependencies: P3-001
- Owner: Human
- Evidence: docs/SSOT_PHASE3.md（phase3/close-design）

### P3-005: 状態モデル（設計のみ）
- Purpose: UX/運用に必要な状態遷移を設計する
- Output Files: docs/SSOT_PHASE3.md
- Acceptance: 状態名/遷移条件/責務が明記されている
- Dependencies: P3-002, P3-003
- Owner: Human
- Evidence: docs/SSOT_PHASE3.md（phase3/close-design）

### P3-006: データ辞書（設計のみ）
- Purpose: 必要なデータ要素と定義を設計する
- Output Files: docs/SSOT_PHASE3.md
- Acceptance: 用語/フィールド/意味/参照元が明記されている
- Dependencies: P3-004
- Owner: Human
- Evidence: docs/SSOT_PHASE3.md（phase3/close-design）

### P3-007: 権限/監査の境界（設計のみ）
- Purpose: 操作権限と監査対象を設計する
- Output Files: docs/SSOT_PHASE3.md
- Acceptance: 役割/操作/監査対象が明記されている
- Dependencies: P3-003
- Owner: Human
- Evidence: docs/SSOT_PHASE3.md（phase3/close-design）

### P3-008: リスク/切戻し方針（設計のみ）
- Purpose: リスクと切戻しの前提を設計する
- Output Files: docs/SSOT_PHASE3.md
- Acceptance: 想定リスク/回避策/切戻し方針が明記されている
- Dependencies: P3-001
- Owner: Human
- Evidence: docs/SSOT_PHASE3.md（phase3/close-design）

### P3-009: Phase4以降の実装境界
- Purpose: Phase3とPhase4の境界を固定する
- Output Files: docs/SSOT_PHASE3.md
- Acceptance: Phase3ではやらない/Phase4でやることが明記されている
- Dependencies: P3-001
- Owner: Human
- Evidence: docs/SSOT_PHASE3.md（phase3/close-design）

### P3-010: Acceptance整備
- Purpose: 設計成果物の受入条件を固定する
- Output Files: docs/ACCEPTANCE_PHASE3.md
- Acceptance: Given/When/Then が設計成果物に対応している
- Dependencies: P3-001
- Owner: Human
- Evidence: docs/ACCEPTANCE_PHASE3.md（phase3/close-design）

## Phase4 Carryover (Design Pending)
- 人間運用フローの定例頻度（日次/週次など）: SSOT Phase3 の持ち越し表に記載
- 承認基準（送信可否の判断条件）: SSOT Phase3 の持ち越し表に記載
- Phase4 以降の実装方針と境界: SSOT Phase3 の持ち越し表に記載
