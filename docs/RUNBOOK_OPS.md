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

## Phase740 運用手順（Next-gen UX add-only）

### LinkRegistry 2.0 運用
1. monitor > Task Detail Link Registry で対象 link を選択する。
2. `intentTag/audienceTag/regionScope/riskLevel` を設定して `link-registry-set`。
3. 422 が返る場合は enum値を見直す（未指定は空欄のまま）。

### Task Micro-Learning 運用
1. monitor > Task Detail Editor で `taskKey` を読み込む。
2. `summaryShort/topMistakes/contextTips` を改行で編集する。
3. `task-content-plan` で警告を確認後、`task-content-set` を実行する。
4. LINE `TODO詳細:{todoKey}` で「概要/失敗/状況注意」が表示されることを確認する。

### CityPack モジュール購読運用
1. city-pack pane > Content Manager で `modules` を設定して保存する。
2. LINEで `CityPack案内` を送信し、購読ボタン（postback）を操作する。
3. CityPack bulletin を作成する場合は `modulesUpdated[]` を指定し、購読者のみ配信対象になることを確認する。

### Notification Attention Budget（日次3件既定）
1. `ENABLE_JOURNEY_ATTENTION_BUDGET_V1=1` を確認する。
2. `JOURNEY_DAILY_ATTENTION_BUDGET_MAX`（既定3）を必要時のみ調整する。
3. `notification_deliveries` を基準に日次送達数を確認する（`deliveries` は参考値）。
4. budget超過時は TaskNudge/CityPack送信が skip されるため、運用判断時は `notification_deliveries` 件数を優先する。

## Phase741 運用手順（US Assignment Task OS add-only）

### Rich Menu Task OS 入口を構成する
1. dry-run:
  - `node tools/migrations/rich_menu_task_os_seed.js`
2. apply:
  - `node tools/migrations/rich_menu_task_os_seed.js --apply --enable-policy`
3. 指定ユーザーへ binding も投入する場合:
  - `node tools/migrations/rich_menu_task_os_seed.js --apply --enable-policy --line-users=Uxxx,Uyyy`
4. monitor > rich-menu status で `policy.enabled=true` と template/rule を確認する。

### LINE導線確認（Task OS）
1. `今やる`:
  - `next_tasks` が最大3件返ることを確認。
2. `今週の期限`:
  - 返信が「期限（7日以内）」と「期限超過」の2セクションで返ることを確認。
  - どちらも0件の場合は `期限（7日以内）/期限超過の未完了タスクはありません。` が返ることを確認。
3. `地域手続き`:
  - region未設定時は地域入力案内、設定済み時はregional/nationwide合成結果を返すことを確認。
4. `TODO一覧`:
  - 従来一覧表示が secondary surface として非退行であることを確認。
5. `カテゴリ`:
  - カテゴリ件数表示に `ブロック:x件` が含まれることを確認。
6. `カテゴリ:IMMIGRATION`:
  - 該当カテゴリのみ表示されることを確認。
7. `通知履歴`:
  - `notification_deliveries` ベースの履歴が返ることを確認。
8. `TODO業者:<todoKey>`:
  - `recommendedVendorLinkIds` から利用可能リンクのみ返ることを確認。
9. `相談`:
  - 「案内表示 + 利用イベント記録のみ / チケット作成なし」の文面が返ることを確認。

### CityPack 推奨タスク seed
1. `city_packs.recommendedTasks[]` を投入する。
2. LINEで地域申告を実施する（`declareCityRegionFromLine`）。
3. `syncCityPackRecommendedTasks` が best-effort で起動し、未存在 task のみ作成されることを確認する。
4. audit log `city_pack.recommended_tasks.sync` を確認する。

### Notification narrowing（Journey reminder）
1. 有効条件:
  - `ENABLE_JOURNEY_REMINDER_JOB=1`
  - `ENABLE_JOURNEY_NOTIFICATION_NARROWING_V1=1`
2. trigger 判定:
  - `due_soon_7d|blocker_resolved|regional_confirmed|family_critical` 以外は送信しない。
3. quiet hours:
  - `journeyPolicy.notificationCaps.quietHours` が有効時間なら skip。
4. daily cap:
  - `JOURNEY_PRIMARY_NOTIFICATION_DAILY_MAX`（既定1）を超えたら skip。
5. evidence:
  - `journey_reminder_runs.skipReasonCounts/triggerCounts`
  - events: `journey_primary_notification_sent`, `notification_fatigue_guarded`, `notification_quiet_hours_guarded`, `notification_narrowing_skipped`

### Partial / Degraded Semantics（通知・Reminder）
1. `POST /internal/jobs/journey-todo-reminder`
  - 全件成功: `200`, `ok=true`, `status=completed`
  - 部分失敗: `207`, `ok=false`, `status=completed_with_failures`, `partialFailure=true`
  - `sendSummary` を確認: `totalRecipients/attemptedRecipients/deliveredCount/skippedCount/failedCount`
2. `POST /api/admin/os/notifications/send/execute`
  - 全件成功: `200`, `ok=true`
  - 部分失敗: `207`, `ok=false`, `partial=true`, `reason=send_partial_failure`
  - `sendSummary.partialFailure=true` の場合は execute 再試行時に `deliveryId` 冪等制御で重複送信を防ぐ
3. `POST /api/admin/city-pack-bulletins/:id/send`
  - 全件成功: `200`, bulletin `status=sent`
  - 部分失敗: `207`, `ok=false`, `partial=true`, bulletin `status=approved` のまま再送待ち
4. `POST /api/admin/emergency/bulletins/:id/approve`
  - 全件成功: `200`, bulletin `status=sent`
  - 部分失敗: `207`, `ok=false`, `partial=true`, bulletin `status=approved` のまま再送待ち
5. 監視:
  - `failedCount`
  - `failureSample`
  - `reason=send_partial_failure`
6. outcome contract:
  - JSON route は `outcome.state` を併せて確認する（`success|degraded|partial|error|blocked`）。
  - プレーン/redirect route は `x-member-outcome-state` ヘッダを確認する。
  - `ok=true` だけで成功判定しない。`degraded/partial` は別扱いで運用判断する。

### Suppressed Error 監査契約（Phase PR4）
1. best-effort catch は握りつぶさず `"[suppressed_error]"` で構造化ログを残す。
2. 監視キー:
  - `scope`（例: `notifications.sendNotification`）
  - `stage`（例: `append_ux_event_failed`）
  - `traceId` / `requestId` / `lineUserId`（存在時）
3. Notification/Journey の運用確認:
  - `gcloud logging read 'textPayload:\"[suppressed_error]\"' --limit 100 --format='value(textPayload)'`
  - 連続発生する `stage` は route/job の degraded 予兆として扱う。
4. read-only 実行ルール:
  - `npm run test:trace-smoke` は `TRACE_SMOKE_WRITE_EVIDENCE=0` を固定し tracked docs を更新しない。

### Journey policy quietHours 契約（Phase746）
1. canonical:
  - `opsConfig/journeyPolicy.notificationCaps.quietHours`
2. backward-compatible accepted input（normalize吸収のみ）:
  - `notification_caps`（snake_case）
  - top-level `quietHours`
  - top-level `quiet_hours`
3. invalid条件:
  - `startHourUtc/endHourUtc` が整数0..23以外
  - `startHourUtc === endHourUtc`
4. plan/set運用:
  - quietHours含む `notificationCaps` 変更時は `journey-policy/plan` を再実行して confirm token を更新する。

### Canonical Authority 契約（Phase PR3）
1. Redac naming:
  - canonical: `redac_membership_links`, `redacMembershipIdHash`, `redacMembershipIdLast4`
  - legacy read fallback: `ridac_membership_links`, `ridacMembershipIdHash`, `ridacMembershipIdLast4`
  - new write は canonical のみ。legacy への新規writeは禁止。
2. Ops state naming:
  - canonical collection: `ops_states`
  - legacy read fallback: `ops_state`
  - `setOpsReview` を含む運用writeは canonical のみ。
3. 互換read証跡:
  - warning log: `[canonical_authority] scope=... mode=legacy_read ...`
  - audit payload: `legacyReadUsed`, `authoritySource` もしくは `authority.{canonicalCollection,legacyCollection,...}`
4. 監視対象:
  - `canonical_authority.legacy_read_detected`（監査ログ）
  - `redac_membership.status.view` の `summary.usersLegacyReadSampled/linksLegacyReadSampled`
5. 収束条件（sunset）:
  - 連続14日で `legacyReadUsed=false` を維持
  - `ridac_membership_links` と `ops_state` への運用依存ゼロを確認後に legacy read fallback を段階停止

### Task Detail whyNow 契約（Phase746）
1. `task_contents.whyNow` は Task Detail 意味表示の最優先フィールド。
2. 未設定時は既存 fallback（`tasks.meaning.whyNow` → `tasks.whyNow`）を使う。
3. `task_contents` の既存ドキュメントは移行不要（read-time fallback互換）。

### Rollback（Journey UX-Max）
1. 即時停止:
  - `ENABLE_JOURNEY_REMINDER_JOB=0`
  - `ENABLE_JOURNEY_RULE_ENGINE_V1=0`
  - `ENABLE_CITY_PACK_MODULE_SUBSCRIPTION_V1=0`
  - `ENABLE_JOURNEY_NOTIFICATION_NARROWING_V1=0`
  - `ENABLE_JOURNEY_REGIONAL_PROCEDURES_V1=0`
  - `opsConfig/llmPolicy.enabled=false`
2. 段階巻き戻し:
  - `地域手続き` 導線を feature flag で停止し `TODO一覧` 導線へ退避
  - reminder narrowing のみ停止し既存 reminder 動作へ戻す
3. 完全巻き戻し:
  - PR revert（add-only データは参照停止で無害化）

## Phase747 Task Detail Observability運用

### 目的
- `TODO詳細` の開封/続き/完了を `events` と `journey_kpi_daily` で可視化し、完遂率の詰まりを運用判断できるようにする。

### 監査対象イベント
- `todo_detail_opened`
- `todo_detail_section_opened`
- `todo_detail_section_continue`
- `todo_detail_completed`
- `support_guide_opened`

### 監査手順
1. `GET /api/admin/os/journey-kpi?refresh=1` を実行する。
2. `kpi.detailOpenCount/detailContinueCount/detailCompleteCount` を確認する。
3. `kpi.detailOpenToContinueRate/detailOpenToCompleteRate` が急落していないか確認する。
4. `kpi.deliveryToDetailToDoneRate` を確認し、通知→詳細→完了の導線詰まりを検知する。

### しきい値例（運用推奨）
- `detailOpenToContinueRate < 0.25` が3日連続: manualテキスト分割導線を確認。
- `detailOpenToCompleteRate < 0.15` が3日連続: blocker文言とCTAを確認。
- `deliveryToDetailToDoneRate < 0.10` が3日連続: 通知文言/CTA妥当性を確認。

### 相談導線の意味
- `相談` コマンドは「案内表示 + 利用イベント記録」のみを実行し、この時点ではチケット作成しない。
- 証跡は `support_guide_opened` イベントで確認する。
