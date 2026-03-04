# RUNBOOK_OPS

## Purpose
Ops が「迷わず、壊さず、止められる」ための最終Runbook。
LINE-only / SSOT（Firestore）/ traceId 監査を前提に、判断→記録→（必要なら）実行までを人間が責任を持って行う。

## Principles (Hard Rules)
- LINE公式アカウントが唯一のユーザー接点（LIFF/ミニアプリなし）
- 提案（suggestion）は advisory のみ。自動送信・自動実行はしない
- traceId 1本で view → suggest → decision → execute/stop が追える状態を維持
- Kill Switch ON のときは送信副作用（STOP_AND_ESCALATE含む）が必ず止まる

## Preconditions
- `/admin/ops` にアクセスできること（READ ONLY）
- Trace Search（`/api/admin/trace?traceId=...`）で監査ログが参照できること
- 送信を伴う操作をする前に Kill Switch 状態を確認すること（ONなら送信しない）
- `GET /api/admin/product-readiness` が `status=GO` であること（`checks.retentionRisk.ok=true` と `checks.structureRisk.ok=true` と `checks.structureRisk.activeLegacyRepoImports=0` を含む）

## Steps
### 1) Ops Console を開く（view）
1. `/admin/ops` を開く
2. Ops Console 一覧 → 詳細 を開く
3. 以下を確認する
   - `readiness.status` / `blockingReasons`
   - `riskLevel`（LOW/MEDIUM/HIGH）
   - `lastReactionAt（LINE定義）`
   - `notificationHealthSummary` / `unhealthyNotifications`
   - `mitigationSuggestion（advisory）`

期待される証跡（best-effort）:
- `audit_logs.action=ops_console.view`（traceId付き）
- unhealthy がある場合: `audit_logs.action=notification_mitigation.suggest`

### 2) STOP 判断（止める/見送る）
#### STOP Criteria（例）
- `readiness.status=NOT_READY` または `blockingReasons` が解消不能
- `riskLevel=HIGH`
- 通知 health が `DANGER`（sent>=30 かつ ctr<0.05）で原因不明
- 不正/異常が疑われる（想定外の配信、想定外のリンク、Kill Switch 未確認 など）

STOP の方針:
- 送信を伴う実行は行わず、調査→復旧の順で進める
- 必要なら kill switch を ON にして事故を止める（運用手順に従う）

### 3) Decision を残す（decision）
1. Ops Decision Submit で `nextAction` を選択（allowedNextActions の範囲のみ）
2. `notification mitigation decision`（ADOPT/REJECT/SKIP + note）は「提案」に対する人間判断として記録したい場合のみ入力
3. submit を実行

期待される証跡（best-effort）:
- `audit_logs.action=ops_decision.submit`
- mitigation decision を入力した場合: `audit_logs.action=notification_mitigation.decision`
- `decision_logs.subjectType=user` に audit snapshot が保存される（traceId連結）

### 4) Execute（必要な場合のみ）
原則:
- 実行は人間Opsが責任を持って行う
- Kill Switch を確認し、送信を伴う経路は特に慎重に扱う

期待される証跡（best-effort）:
- `audit_logs.action=ops_decision.execute`
- `decision_logs.subjectType=ops_execution`
- `decision_timeline.action=EXECUTE`

### 5) Trace Search で監査する（traceId 1本で追える）
1. Ops Console 詳細に表示される `traceId` をコピー（またはクリック）
2. Trace Search で `audit_logs / decision_logs / decision_timeline` を確認する
3. 次が時系列で追えることを確認する
   - view（ops_console.view）
   - suggest（notification_mitigation.suggest）
   - decision（ops_decision.submit / notification_mitigation.decision）
   - execute/stop（ops_decision.execute / decision_timeline）

注意:
- `trace_search.view` は Trace API を呼んだ時点で best-effort で追加される（レスポンスに含まれない場合がある）

### 6) Launch前の retention readiness を確認する
1. `/api/admin/product-readiness` を実行する
2. `checks.retentionRisk` を確認する
   - `ok=true`
   - `generatedAtHours` が `freshnessHoursMax` 以下
   - `undefinedRetentionCount` / `undefinedDeletableConditionalCount` / `undefinedRecomputableCount` が `budget` 以下
3. `blockers` に `retention_risk_*` があれば送信運用を開始しない

### 7) Launch前の structure readiness を確認する
1. `/api/admin/product-readiness` を実行する
2. `checks.structureRisk` を確認する
   - `ok=true`
   - `generatedAtHours` が `freshnessHoursMax` 以下
   - `legacyReposCount` / `mergeCandidatesCount` / `namingDriftScenarioCount` / `unresolvedDynamicDepCount` が `budget` 以下
   - `activeLegacyRepoImports=0`（legacy repo import が稼働導線に残っていない）
3. `blockers` に `structure_risk_*` があれば送信運用を開始しない

## Recovery Rule（delivery stuck）
- 送信処理で `reserved/in-flight` が残り再実行で skip される場合、既定は再送ではなく `seal` で回復する。
- 実施場所: `/admin/master` → Delivery Recovery（plan → execute）。
- `delivery_recovery.plan` / `delivery_recovery.execute` が traceId で追えることを確認する。

## Expected Output
- traceId を1つ指定すると、関連する `audit_logs / decision_logs / decision_timeline` が取得できる
- Ops Console の表示だけで、危険度・反応・提案・判断が把握できる

## Mainline Evidence Reference (stg GO)
- latest fixed-order stg e2e pass: `2026-02-23`, workflow run `22319659529` (`main`)
- result summary: `product_readiness_gate / segment / retry_queue / kill_switch_block / composer_cap_block = PASS`
- 詳細証跡は `docs/archive/phases/PHASE633_EXECUTION_LOG.md` を参照（fail run `22319585228` と recovery 後 rerun 成功を同時記録）

## Rollback
- 直近の変更を戻す場合は revert（実装PR / docs PR）
- 緊急停止は Kill Switch（運用手順に従う）

## Phase730 Task Detail運用（add-only）
### 目的
- LINE `TODO詳細` で表示される Task詳細（manual/failure/video/cta）を運用側で更新する。

### 手順（monitor > Task Engine / Step Rules）
1. `status` を実行して `task_contents` を取得する。
2. `Task Detail Editor` で `taskKey` を入力し、`task-content-load` で既存値を読込む。
3. `title/time/checklist/manual/failure/videoLinkId/actionLinkId` を更新する。
4. `task-content-plan` を実行し、`warnings` を確認する。
5. 問題がなければ `task-content-set` を実行する（planHash + confirmToken 必須）。
6. LINEで `TODO詳細:{todoKey}` を送信し、Manual/Fault postback を含めて表示確認する。

### Link Registry最小運用
1. `Task Detail Link Registry` で `link-registry-reload` を実行する。
2. 新規リンクは `title/url/kind/enabled` を入力して `link-registry-create`。
3. 既存リンクの有効/無効やURL更新は `linkId` 指定で `link-registry-set`。

### 緊急停止
- `ENABLE_TASK_DETAIL_LINE_V1=0` で LINE詳細導線を即時停止。
- `ENABLE_TASK_CONTENT_ADMIN_EDITOR_V1=0` で管理画面編集導線を即時停止。
- `ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1=0` で長文安全弁を停止（旧挙動）。

### 編集責務（混同防止）
| 編集対象 | 触る画面 | 変更内容 | ユーザー影響 |
| --- | --- | --- | --- |
| `task-rules` | Task Engine / Step Rules | 判定条件、配信条件、依存関係 | 通知判定とToDo生成に影響 |
| `task-content` | Task Detail Editor | 表示タイトル、manual/failure、video/cta | `TODO詳細` 表示に即時反映（判定ロジックは不変） |

### 事故例と回避策
- 混同: `task-rules` を編集すべき場面で `task-content` を編集しても判定は変わらない。  
  - 回避: 編集前に上表で対象を確認し、`task-content warning` が `-` 以外なら先に解消する。
- 未紐付け: `taskKey` が `step_rules.ruleId` と一致しない。  
  - 回避: `task-content warning` の「未紐付け」表示を解消してから set する。
- 無効リンク: `videoLinkId/actionLinkId` が disabled/WARN。  
  - 回避: Link Registry で `enabled=true` / health正常化後に plan を再実行する。

### stg実機検証手順（再現用）
1. 前提確認:
   - stg 環境変数に `ENABLE_TASK_DETAIL_LINE_V1=1` / `ENABLE_TASK_CONTENT_ADMIN_EDITOR_V1=1` を設定。
   - 安全弁確認は `ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1=1`（default）。
2. 監査起点を作成:
   - Admin monitor の `trace` を再生成し、操作ログを同一 traceId で実施。
3. Task Content 更新:
   - `task-content-load -> task-content-plan -> task-content-set` を実行。
4. LINE操作:
   - `TODO詳細:{todoKey}` を送信。
   - `📖 手順マニュアル` / `⚠ よくある失敗` の postback を押下。
5. 確認:
   - Flex header/body/footer が欠落なく表示される。
   - Manual/Failure は `【... i/n】` 付きで送信される。
   - 分割上限超過時は continuation command が案内される（例: `TODO詳細続き:bank_open:manual:4`）。
6. 失敗時切り分け:
   - webhook route: `admin errors` で `webhook_line` / journey postback エラーを確認。
   - Link解決: `task-content warning` と plan warnings を確認。
   - reply/push順: LINE受信ログで `i/n` 番号の欠落有無を確認。

### stgチェックリスト（必須ケース）
- Case A: manual短文（1チャンク）で postback 返信成功。
- Case B: manual長文（2万文字級、絵文字混在）で continuation command が出る。
- Case C: `videoLinkId/actionLinkId` が disabled/WARN/未設定で fail-close 表示。
- Case D: `checklistItems` 空で「やること」セクション非表示。
- Case E: 分割数 > `TASK_DETAIL_SECTION_CHUNK_LIMIT` で安全弁動作。
- Case F: postback payload破損で fail-close（既存導線維持、サーバー異常なし）。

### stg証跡テンプレート（実施時に追記）
- 実施日:
- 実施者:
- traceId:
- 対象 todoKey/taskKey:
- Case A-F 結果:
- 異常時ログ:
- ロールバック実施有無:

### stg証跡（2026-03-04 実施ログ）
- 実施日: 2026-03-04
- 実施者: codex (AI)
- traceId/requestId prefix: `t730-stg-*`
- 対象 lineUserId: `U730STG000000000000000000000001`
- 対象 todoKey/taskKey:
  - `t730_case_a`
  - `t730_case_b`
  - `t730_case_c`
  - `t730_case_d`
  - `t730_case_e`
- Case A-F 結果:
  - A PASS: `TODO詳細:t730_case_a` + manual postback で Flex + `【手順マニュアル 1/1】`
  - B PASS: `TODO詳細:t730_case_b` + manual postback で `1/8..3/8` + continuation command
  - C PASS: `TODO詳細:t730_case_c` で video/action fail-close（非表示）
  - D PASS: `TODO詳細:t730_case_d` で checklist空時「やること」非表示
  - E PASS: `TODO詳細:t730_case_e` + manual postback + `TODO詳細続き:t730_case_e:manual:4` で安全弁確認
  - F PASS: postback `section=broken` で fail-close（`handled:false`）、webhookは200
- webhookログ抜粋:
  - `t730-stg-a-msg`: `[webhook] ... accept` / `[OBS] action=webhook result=ok ...`
  - `t730-stg-e-manual`: `[webhook] ... accept` / `[OBS] action=webhook result=ok ...`
  - `t730-stg-f-broken`: `[webhook] ... accept` / `[OBS] action=webhook result=ok ...`
- 異常時ログ:
  - synthetic webhookのため replyToken はダミー。messageケースで `LINE API error: 400` を観測（Journey処理/fail-close検証は継続）
- ロールバック実施有無: なし
