# SSOT Phase3 (v0.2)

## Phase3 START（設計フェーズ）
- Phase3 は「設計・構造確定フェーズ」として開始する
- 実装は行わない

## Phase3 の目的
- Phase1/2で溜まったデータ・運用を前提に、UX / 管理UI / 人間運用の明確化を行う
- 壊れない拡張のための構造決定を行う

## Phase3 で決めること
- UX 境界（Mini / Admin / 人手運用 の責務分離）
- 人間運用フロー（誰が・いつ・何を見て・何を判断し・何を操作するか）
- Phase3 で設計する範囲（構造化の対象範囲）
- Phase4 以降の実装方針と境界

## Phase3 で決めないこと（重要）
- 実装の具体化
- 自動化の導入
- AI 判断・最適化
- Phase0/1/2 の仕様変更

## Phase3 では実装しない（Non-Goals）
- 既存コード/DB/CI/CD/権限/公開範囲/Webhook の変更
- UX 改善や新機能追加
- 自動判断・自動配信・AI導入

## スコープ境界（Phase2 までとの差分）
- Phase2: 安全な自動化 + 集計（read-model）
- Phase3: それらを前提に「人間が判断するための構造」を確定

## MUST（A1 決定事項の固定）
### A1-1. Phase2 集計結果（read-model）の閲覧場所
- Admin UI で閲覧可能とする
- 人手運用（UI外）は「閲覧・確認・証跡保管」のみ
- 運用判断・操作の主体は Admin UI に限定する

### A1-2. Mini App の責務（ユーザー向け）
- 通知一覧（inbox）の閲覧
- チェックリストの表示
- チェックリスト完了トグル
- ユーザー属性の最小入力（memberNumber のみ）
- 上記以外の判断・制御・集計は行わない

### A1-3. Admin UI の責務（運用者向け）
- 通知の作成・送信
- Link Registry の管理
- Phase2 read-model に基づく集計結果の閲覧
- 人間による運用判断と操作の実行

### A1-4. 人手運用（UI外）の責務
- UI外の人手運用は「補助的閲覧・確認」のみ
- 判断・操作・意思決定はすべて Admin UI に集約する

### A1-5. 判断の場所
- 次通知・運用判断は人間が Admin UI を見て判断する
- 自動判断・AI判断は Phase3 では一切行わない

### A1-6. Mini からの書き込み許可
- checklist の完了 / 未完了トグル
- ユーザー属性の最小入力（memberNumber のみ）
- 許可属性の追加は禁止

## P3-002: UX 境界（できること/できないこと）
### Mini（ユーザー向け）
- できること: inbox閲覧 / checklist閲覧 / checklistトグル / memberNumber入力
- できないこと: 集計閲覧 / 通知作成・送信 / Link Registry 操作 / ルール判断

### Admin（運用者向け）
- できること: 通知作成・送信 / Link Registry 管理 / Phase2 read-model 閲覧 / 人間判断の実行
- できないこと: 自動判断 / AI判断 / UI外の直接操作（DB直書き等）

### 人手運用（UI外）
- できること: 閲覧・確認・証跡保管（外部ツール/ダッシュボード等）
- できないこと: 判断・操作・意思決定（必ず Admin UI に集約）

## P3-003: 人間運用フロー（最終版: ステップ表）
### 通常フロー
| Who | When | What | Decision |
| --- | --- | --- | --- |
| Mini | 任意 | inbox/checklist を閲覧 | 判断なし（ユーザー操作） |
| Mini | 任意 | checklist トグル / memberNumber 入力 | 判断なし（ユーザー操作） |
| Admin | 定例運用時 | Phase2 read-model を閲覧 | 判断材料の整理（人間判断） |
| Admin | 判断タイミング | 次アクションを決定 | 送信可否の人間判断 |
| Admin | 決定後 | 通知作成・送信 / Link Registry 更新 | 実行判断は人間 |
| 人手運用 | 必要時 | 補助的閲覧・確認・証跡保管 | 判断なし（補助のみ） |

### 例外フロー（承認／差戻し／緊急停止）
| Who | When | What | Decision |
| --- | --- | --- | --- |
| Admin | 承認時 | 承認を確定 | 人間判断（承認） |
| Admin | 差戻し時 | 差戻し理由を記録 | 人間判断（差戻し） |
| Admin | 緊急停止時 | Kill Switch で送信停止 | 人間判断（停止） |
| 人手運用 | 必要時 | 証跡保管 | 判断なし（補助のみ） |

## 設計範囲（構造化の対象）
Phase3 で設計対象に含めるものは以下に限定する。
- 画面遷移（Mini/Admin）
- 状態モデル（checklist / notification / user）
- データ辞書（参照のみ）
- 権限 / 監査境界
- テンプレ運用（通知・Link Registry の運用前提）
- リスク / 切戻し方針

## P3-004: 画面遷移設計（設計のみ）
### Mini（ユーザー向け）
Home
 -> Inbox（通知一覧）
 -> Checklist（チェックリスト）
 -> Member（memberNumber入力）

### Admin（運用者向け）
Admin Home
 -> Notifications（作成・送信）
 -> Link Registry（管理）
 -> Reports（read-model閲覧）
 -> Audit（監査ログ閲覧）
 -> Kill Switch（緊急停止）

## P3-005: 状態モデル（設計）
### Checklist item（user_checklists）
- Pending: completedAt = null
- Completed: completedAt = timestamp
- 異常系: itemId/checklistId 不整合 → 表示しない（人間判断）

### Notification
- Draft: 作成済み/未送信
- Sent: 送信済み
- Stopped: 停止（Kill Switch 等）

### User
- Identified: lineUserId あり
- ProfileBasic: memberNumber あり

## P3-006: データ辞書（参照のみ）
※ Phase0/1/2 のデータは再定義せず「参照」として列挙する。
- users: lineUserId, scenario, attributes, memberNumber（参照）
- notifications: status, scenario, step, message, linkRegistryId（参照）
- notification_deliveries: notificationId, lineUserId, sentAt（参照）
- events: lineUserId, type, ref, createdAt（参照）
- checklists: scenario, step, items（参照）
- user_checklists: lineUserId, checklistId, itemId, completedAt（参照）
- link_registry: title, url, lastHealth（参照）
- phase2_reports_* / phase2_runs: read-model（参照）

## P3-007: 権限・監査境界（設計）
### 役割
- 運用担当: 通知作成・送信 / Link Registry 管理 / 集計閲覧
- 管理責任者: 判断の確定 / 緊急停止
- ユーザー: Mini の閲覧/トグル/入力のみ

### 監査
- Admin 操作はすべて監査ログに記録（audit_logs 参照）
- 監査対象: 通知作成/送信、Link Registry 操作、Kill Switch

## P3-008: テンプレ運用（通知・Link Registry）
- 通知テンプレは Admin UI で管理する
- Link Registry は Admin UI で管理する
- テンプレ内容は人間判断で更新する（自動生成なし）

## P3-009: リスク・切戻し方針（設計）
- 運用ミス: 検知=監査ログ/レビュー、対応=差戻し、切戻し=操作履歴に基づく修正
- 誤送信: 検知=配信履歴、対応=Kill Switch、切戻し=再送せず次通知で調整
- 誤判断: 検知=定例レビュー、対応=判断の再確認、切戻し=手動再調整
- 緊急停止: 検知=人間判断、対応=Kill Switch、切戻し=手動再開

## Phase3 CLOSE 条件（明文化）
- SSOT が確定し、MUST/Non-Goals/設計範囲が明文化されている
- 人間運用フロー（ステップ表）が通常/例外で成立している
- 画面遷移/状態モデル/データ辞書/権限/監査/テンプレ運用/リスクが設計として存在する
- 未決定事項が Phase4 持ち越しとして整理されている

## 仕分け（確定済み / Phase4 持ち越し）
### Phase3 で確定済み
- A1-1 〜 A1-6（UX/運用境界）
- Mini/Admin/人手運用 の責務分離
- 人間判断の場所（Admin UI）
- 例外対応（承認/差戻し/緊急停止）の設計

### Phase4 へ持ち越す（理由/判断主体）
| 項目 | 理由 | 判断主体 | 期限 |
| --- | --- | --- | --- |
| 人間運用フローの定例頻度（日次/週次など） | 実運用の決定が必要 | 人間 | TBD |
| 承認基準（送信可否の判断条件） | 判断基準の合意が必要 | 人間 | TBD |
| Phase4 以降の実装方針と境界 | 実装計画の合意が必要 | 人間 | TBD |
