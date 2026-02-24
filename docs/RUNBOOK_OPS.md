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
