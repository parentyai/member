# TODO Phase 4 Ledger

## Backlog

### P4-001: Phase4 SSOT準備
- Purpose: Phase4 の目的/スコープ/非目的を明文化する
- Dependencies: Phase3 SSOT / CLOSE
- Blocking Decision: No（人間判断確定済み）

### P4-002: Phase4 未決定事項の確定
- Purpose: Phase3 持ち越し事項を確定する
- Dependencies: Phase3 持ち越し事項一覧
- Blocking Decision: No（人間判断確定済み）

### P4-003: 実装開始前チェックリスト確定
- Purpose: Phase4 開始前の人間判断項目を確定する
- Dependencies: Phase4 SSOT
- Blocking Decision: No（人間判断確定済み）

## In Progress

### P4-101: Mini memberNumber 入力
- Purpose: Mini で memberNumber を入力/更新できるようにする
- Dependencies: Phase3 SSOT（Mini責務の確定）
- Blocking Decision: No（人間判断確定済み）
- Output: apps/mini/member_phase4.html, /api/phase1/mini/member, usecases/users/*
- Evidence: Pending

### P4-105: Admin 運用判断支援（READ ONLY）
- Purpose: Admin が判断材料を一覧で確認できるようにする（読み取りのみ）
- Dependencies: Phase3 SSOT（Admin責務の確定）
- Blocking Decision: No（人間判断確定済み）
- Output: /api/phase4/admin/users-summary, /api/phase4/admin/notifications-summary, apps/admin/ops_readonly.html
- Evidence: Pending

## Done
### P4-102: Mini checklist トグル（read/write）最小実装
- Purpose:
  - ユーザーが checklist の各項目を完了/未完了でトグルできるようにする（自己申告）。
- Input:
  - lineUserId（既存識別）
  - itemKey（チェックリスト項目ID）
  - done:boolean
- Output:
  - GET: checklist 表示に done 状態が反映される
  - POST: done 状態が保存される
- Allowed Writes (MUST):
  - users/{lineUserId} 配下の checklist 状態（最小フィールドのみ）
  - それ以外のコレクション・フィールド追加は禁止（必要なら SSOT delta → 人間判断）
- Non-goals:
  - checklist項目の自動生成/推定
  - 集計ダッシュボード/運用自動化
  - UIの装飾改善
- Acceptance (minimum):
  - toggle API が 200 を返す（不正入力は 400）
  - toggle 後に GET checklist で反映される
  - `npm test` で追加テストが pass
- Dependencies:
  - P4-101（memberNumber）DONE（PR #56 + evidence PR #57）
- Evidence:
  - PR #59
  - Test: node --test tests/phase4/checklistToggle.test.js (PASS)
  - Date: 2026-01-29
### P4-103: Mini inbox 既読反映（最小実装）
- Purpose: Mini で通知を開いたタイミングで readAt を記録する
- Dependencies: Phase3 SSOT（Mini inbox 責務）
- Blocking Decision: No（人間判断確定済み）
- Output: /api/mini/inbox/read, inbox 既読表示
- Evidence:
  - PR #61
  - Test: node --test tests/phase4/inboxRead.test.js (PASS)
  - Date: 2026-01-29
### P4-104: Admin 集計閲覧（READ ONLY）
- Purpose: Admin で通知の配信/既読/クリックの件数を閲覧できるようにする（読み取りのみ）
- Dependencies: Phase3 SSOT（Admin責務の確定）
- Blocking Decision: No（人間判断確定済み）
- Output: /admin/read-model/notifications, apps/admin/read_model.html
- Evidence:
  - PR #63
  - Test: node --test tests/phase4/adminReadModel.test.js (PASS)
  - Date: 2026-01-29
### P4-105: Admin 運用判断支援（READ ONLY）
- Purpose: Admin が判断材料を一覧で確認できるようにする（読み取りのみ）
- Dependencies: Phase3 SSOT（Admin責務の確定）
- Blocking Decision: No（人間判断確定済み）
- Output: /api/phase4/admin/users-summary, /api/phase4/admin/notifications-summary, apps/admin/ops_readonly.html
- Evidence:
  - PR #65
  - Test: node --test tests/phase4/adminOpsSummary.test.js (PASS)
  - Date: 2026-01-29
