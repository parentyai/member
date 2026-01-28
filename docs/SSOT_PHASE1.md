# SSOT Phase1 v0.2 (Design Only)

- Updated: 2026-01-28
- Source: Phase1 design prompt (this repository)
- Scope: Phase1 only (Phase0 is CLOSED and immutable)

## 1. 目的（Phase1のゴール）
1) データが溜まり始める
- Firestore に永続データが記録される
2) Phase0で定義されたUXが“実体化”する
- チェックリスト表示 / 完了
- 通知 → 行動 → ログ の循環
3) 人間が運用できる
- 管理画面から“最小操作”で回る
- 自動判断は一切しない

## 2. しないこと（禁止）
- AIによる文言生成・判断・最適化
- レコメンド/最適化/A/Bテスト
- Phase0仕様の変更・再解釈・再構成
- 権限/公開範囲/CI/CD/Webhook構成の変更

## 3. Phase0前提（固定）
- Phase0関連ファイルは参照のみ（編集禁止）
- member / member-webhook 分離は維持
- 公開範囲・権限・CI/CDは変更しない

## 4. データモデル（FIX）
詳細は `docs/DATA_MODEL_PHASE1.md` に定義する。
- users
- checklists
- user_checklists
- notifications
- notification_deliveries
- events

## 5. Linkの扱い（FIX）
- Phase1で新しいリンク概念を作らない
- すべて Phase0資産の Link Registry を参照
- フィールド名は必ず `linkRegistryId`
- `linkKey` / `url` / 直リンクは禁止

## 6. user_checklists の一意性（FIX）
- Firestore docId を以下で固定：
  `${lineUserId}__${checklistId}__${itemId}`
- upsert 前提、二重生成禁止
- `completedAt` は null / timestamp で表現

## 7. events の構造と責務（FIX）
### 7.1 append-only
- create のみ許可
- update / delete 禁止
- 失敗しても主処理を止めない（best-effort）

### 7.2 ref 構造（固定）
```
ref: {
  notificationId?: string,
  checklistId?: string,
  itemId?: string
}
```

### 7.3 type別 必須条件（固定）
- open: notificationId 必須
- click: notificationId 必須
- complete: checklistId + itemId 必須

## 8. notification_deliveries の扱い（FIX）
- Phase0の delivery 概念を継続使用
- 役割は「送った事実と時刻」を残すだけ
- events と delivery の役割分離：
  - delivery = 送った事実
  - events = 人間の行動
- UX判断・最適化には使用しない

## 8.1 通知送信対象選定ルール（FIX追記）
- Phase1 の送信対象は `users.scenario` の一致のみで決定する
- `notifications.step` は Phase1では配信条件に使用しない
- `users` に step（currentStep等）を追加して一致判定する実装は禁止
- `notifications.step` は運用ラベル/整理ラベルとして保持のみ可

## 9. ID生成ルール（FIX）
| Entity | ID生成方式 | 生成責務 |
| --- | --- | --- |
| users | lineUserId | 外部入力 |
| checklists | Firestore autoID | repo |
| notifications | Firestore autoID | repo |
| notification_deliveries | Firestore autoID | repo |
| events | Firestore autoID | repo |

## 10. scenario / step 解決ルール（FIX）
- 優先順位: users.scenario → checklist.scenario+step → notification.scenario+step
- 不整合時: 例外禁止、ログのみ、UIは「表示しない」

## 11. 時刻・削除ルール（FIX）
- すべて Firestore serverTimestamp を使用
- クライアント時刻使用禁止
- delete は原則禁止（状態で非表示）

## 12. 実装ルール（設計として明文化）
- UI → API → Usecase → Repo → DB の一方向
- 書き込みは Repository 経由のみ
- Firestore 直アクセス禁止
- import 時副作用禁止
- entry point は `src/index.js` のみ

## 13. 次通知の扱い（FIX）
- Phase1で自動生成・自動選択はしない
- 次通知は管理画面で人間が手動作成
- Phase1の役割は「判断材料（ログ）を出す」まで

## 14. 受入基準（要約）
- Firestore に Phase1データが保存される
- チェックリスト表示/完了が実体化される
- 通知 → 行動 → ログ の流れが最小で成立
- 管理画面で最小運用が可能
詳細は `docs/ACCEPTANCE_PHASE1.md`。

## 15. 実装順序（設計）
1) Phase1 SSOT/Architecture/Data Model/Traceability/TODO
2) Firestore Repositories（Phase1追加分）
3) Usecases（通知/チェックリスト/イベント）
4) API routes（admin/mini）
5) UI（admin/mini）
6) テスト（repo/usecase/E2E）
7) 運用ドキュメント整備

## 16. 変更管理
- Phase1の変更は `docs/SSOT_PHASE1.md` にのみ反映
- Phase0には一切手を触れない
