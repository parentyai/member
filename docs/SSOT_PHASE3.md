# SSOT Phase3 (v0.1)

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

## スコープ境界（Phase2 までとの差分）
- Phase2: 安全な自動化 + 集計（read-model）
- Phase3: それらを前提に「人間が判断するための構造」を確定

## 決定事項（UX / 運用 境界）
### A1. Phase2 集計結果（read-model）の閲覧場所
- Admin UI で閲覧可能とする
- 人手運用（UI外）は「閲覧・確認・証跡保管」のみ
- 運用判断・操作の主体は Admin UI に限定する

### A2. Mini App の責務（ユーザー向け）
- 通知一覧（inbox）の閲覧
- チェックリストの表示
- チェックリスト完了トグル
- ユーザー属性の最小入力（memberNumber のみ）
- 上記以外の判断・制御・集計は行わない

### A3. Admin UI の責務（運用者向け）
- 通知の作成・送信
- Link Registry の管理
- Phase2 read-model に基づく集計結果の閲覧
- 人間による運用判断と操作の実行

### A4. 人手運用（UI外）の責務
- UI外の人手運用は「補助的閲覧・確認」のみ
- 判断・操作・意思決定はすべて Admin UI に集約する

### A5. 判断の場所
- 次通知・運用判断は人間が Admin UI を見て判断する
- 自動判断・AI判断は Phase3 では一切行わない

### A6. Mini からの書き込み許可
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

## P3-003: 人間運用フロー（3形式）
### 1) 箇条書き手順（全体像）
1. Phase2 read-model を Admin UI で閲覧する
2. 運用担当が状況を確認し、判断ポイントを明示する
3. 管理責任者が Admin UI 上で判断を確定する
4. Admin UI で通知作成・送信を実行する
5. 必要に応じて Link Registry を更新する
6. 実行後の結果を Admin UI で確認し、証跡を保管する

### 2) ステップ表（Who / When / What / Decision）
| Who | When | What | Decision |
| --- | --- | --- | --- |
| 運用担当 | 定例運用時 | Phase2 read-model を閲覧 | 判断材料の整理（人間判断） |
| 管理責任者 | 判断タイミング | Admin UI で次アクションを決定 | 送信可否の人間判断 |
| 運用担当 | 決定後 | Admin UI で通知作成・送信 | 実行判断は人間 |
| 運用担当 | 送信後 | 結果確認と証跡保管 | 逸脱時の人間判断 |

### 3) Swimlane（役割別）
Mini:    [inbox/checklist閲覧] -> [トグル/入力]
System:  [events蓄積] -> [Phase2集計(read-model)]
Admin:   [read-model閲覧] -> [人間判断] -> [通知作成/送信] -> [結果確認]
人手:    [補助的閲覧/確認] -> [証跡保管]

### 例外フロー（承認／差戻し／緊急停止）
#### 承認
- 判断ポイントは人間判断（Admin UI 内）
- 管理責任者が Admin UI 上で承認し、運用担当が実行

#### 差戻し
- 判断ポイントは人間判断（Admin UI 内）
- 管理責任者が差戻し理由を記録し、運用担当が修正

#### 緊急停止
- 判断ポイントは人間判断（Admin UI 内）
- Kill Switch を使用し送信を停止（Phase0機能）

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

## P3-008: リスク・切戻し方針（設計）
- 運用ミス: 検知=監査ログ/レビュー、対応=差戻し、切戻し=操作履歴に基づく修正
- 誤送信: 検知=配信履歴、対応=Kill Switch、切戻し=再送せず次通知で調整
- 誤判断: 検知=定例レビュー、対応=判断の再確認、切戻し=手動再調整
- 緊急停止: 検知=人間判断、対応=Kill Switch、切戻し=手動再開

## Phase3 完了条件（CLOSE 条件）
- SSOT が確定し、決める/決めないの境界が明確
- TODO が Phase3 の設計タスクとして整理されている
- 未決定事項リストが確定し、判断主体が明記されている

## 未決定事項 / 要判断リスト
| 項目 | 理由 | 影響 | 判断主体 | 期限 |
| --- | --- | --- | --- | --- |
| 人間運用フローの定例頻度（日次/週次など） | 未決定 | 運用スケジュールが確定できない | 人間 | TBD |
| 承認基準（送信可否の判断条件） | 未決定 | 判断の一貫性が確定できない | 人間 | TBD |
| Phase4 以降の実装方針と境界 | 未決定 | 次フェーズの境界が確定できない | 人間 | TBD |
