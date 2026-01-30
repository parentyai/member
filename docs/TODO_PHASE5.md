# TODO Phase5 Ledger

## Backlog

### P5-103: 人間判断トリガ（表示/ログのみ）
- Purpose: 判断すべき状態の検知を表示またはログで提供
- Dependencies: P5-102
- Blocking Decision: Human GO
- Evidence: 未記録

## In Progress

## Done
### P5-001: Phase5 Bootstrap（docs-only）
- Purpose: SSOT / Acceptance / TODO / Guard を作成する
- Dependencies: Phase4 INTERIM CLOSE
- Blocking Decision: No
- Evidence:
  - PR #70
  - Date: 2026-01-29

### P5-101: 状態の可視化（READ ONLY）
- Purpose: 既存データの集計・表示のみを追加する
- Dependencies: P5-001
- Blocking Decision: Human GO
- Evidence:
  - PR #71
  - Test: node --test tests/phase5/stateSummary.test.js (PASS)
  - Date: 2026-01-29

### P5-102: Ops向け READ ONLY 拡張
- Purpose: フィルタ・期間指定など閲覧のみの拡張
- Dependencies: P5-101
- Blocking Decision: Human GO
- Evidence:
  - PR #73
  - Test: node --test tests/phase5/opsFilter.test.js (PASS)
  - Date: 2026-01-29

### P5-104: 運用確認用メタ情報
- Purpose: 最終更新日/最終確認者などのメタ情報（手動更新のみ）
- Dependencies: P5-103
- Blocking Decision: Human GO
- Evidence:
  - PR: https://github.com/parentyai/member/pull/76
  - Test: node --test tests/phase5/opsReview.test.js (PASS)
  - Date: 2026-01-30

### P5-105: Ops 運用サマリ（判断材料の集合）
- Purpose: Ops / Admin が次に何をすべきかを迷わない READ ONLY サマリを提供する
- Dependencies: P5-102, P5-103, P5-104
- Blocking Decision: Human GO
- Evidence:
  - PR: https://github.com/parentyai/member/pull/79
  - Test: node --test tests/phase5/opsAttention.test.js (PASS)
  - Date: 2026-01-30

### P5-106: Ops Review Evidence Write
- Purpose: Ops でユーザー単位の最終確認証跡を手動で保存する
- Dependencies: P5-105
- Blocking Decision: Human GO
- Evidence:
  - PR: https://github.com/parentyai/member/pull/81
  - Test: node --test tests/phase5/opsReviewWrite.test.js (PASS)
  - Date: 2026-01-30
