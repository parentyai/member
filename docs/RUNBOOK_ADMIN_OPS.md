# RUNBOOK_ADMIN_OPS

管理UI（運用OS）で日次運用・事故対応・証跡確定を自走するための runbook。

## Preconditions
- 主チャネル: LINE公式アカウントのみ
- kill switch は「送信副作用の最終停止装置」
- traceId は監査の主キー（Trace Search で追えること）

## Daily Ops (ServicePhase1 / 運用OS v1)
推奨順序（迷わないための一本道）。

1) `/admin/ops`
   - Ops Console list → detail
   - risk / lastReactionAt / blockingReasons を確認
2) `/admin/monitor`
   - 通知単位の reactionSummary / health / CTR を確認
3) `/admin/errors`
   - retry queue / link WARN / guard拒否 を確認
4) `/admin/trace-search`（= `/admin/ops` 内 Trace Search）
   - traceId で view → decision → execute が追えるか確認

## Composer Flow (通知作成 → 承認 → 送信)
1) `/admin/composer`
   - draft 作成（title/body/cta/linkRegistryId/target/scenario/step）
   - preview で本文とリンクを確認
   - approve（active化）
   - plan → confirm token を取得
   - execute（confirm token 必須）
2) Monitor で反応/CTR を確認

## Automation Config（Segment Execute Guard）
`/admin/master` の Automation Config で `mode` を運用する。

- `OFF`: execute しない
- `DRY_RUN_ONLY`: dry-run のみ許可
- `EXECUTE`: execute 許可（他のガードは継続）

操作手順:
1) status を確認
2) desired mode で plan
3) set（confirmToken 必須）
4) trace search で `automation_config.plan` / `automation_config.set` を確認

## Notification Caps（送信上限制御）
`/admin/master` の System Config で `notificationCaps` を設定する。

- `perUserWeeklyCap`
  - `null`: 無効
  - `N`（正の整数）: ユーザー単位の過去7日 delivered 件数が `N` 以上でブロック
- `perUserDailyCap`
  - `null`: 無効
  - `N`（正の整数）: ユーザー単位の過去24時間 delivered 件数が `N` 以上でブロック
- `perCategoryWeeklyCap`
  - `null`: 無効
  - `N`（正の整数）: ユーザー+通知カテゴリ単位の過去7日 delivered 件数が `N` 以上でブロック
- `quietHours`（UTC）
  - `null`: 無効
  - `{startHourUtc,endHourUtc}`: 静穏時間中は送信ブロック（例: 22→7）
- `deliveryCountLegacyFallback`
  - `true`（既定）: deliveredAt 欠損の旧deliveryを `sentAt` で補完集計する（互換優先）
  - `false`: cap判定は `deliveredAt` のみで集計する（性能優先）

操作手順:
1) status で現行値を確認
2) desired cap を入力して plan
   - impact preview の確認ポイント:
     - `blockedEvaluations` / `blockedEvaluationRatePercent`: 評価件数ベースのブロック見込み
     - `estimatedBlockedUsers` / `estimatedBlockedUserRatePercent`: ユーザー単位のブロック見込み
     - `topBlockedCapType` / `blockedByReason`: 主要ブロック要因
3) set（confirmToken 必須）
4) trace search で `system_config.plan` / `system_config.set` を確認

運用推奨:
1) 先に `Delivery deliveredAt Backfill` を実行し、`fixableCount=0` まで補完
2) その後 `deliveryCountLegacyFallback=false` に切り替える
3) 問題があれば `true` に戻す（即時ロールバック）

ブロック時の観測:
- Composer: `notifications.send.execute` / `reason=notification_cap_blocked`
- Segment: `segment_send.execute` / `capBlockedCount>0`
- Retry Queue: `retry_queue.execute` / `reason=notification_cap_blocked`
- 詳細理由は `capType` / `capReason`（`PER_USER_DAILY` / `PER_USER_WEEKLY` / `PER_CATEGORY_WEEKLY` / `QUIET_HOURS`）で判定

## Incident Response (事故時)
1) kill switch ON（Operations）
2) traceId を取得（Ops/Composer/Monitor/Error Console）
3) `/api/admin/trace?traceId=...` で audits/decisions/timeline を確認
4) 原因分類（例）
   - kill switch on（意図した停止）
   - guard拒否（confirm token mismatch / plan mismatch）
   - link WARN
   - composer send failure → `notifications.send.execute`（ok=false）audit を確認
   - segment send failure → retry queue
5) Mitigation（人間判断）
   - 再送/停止/テンプレ差し替え/リンク差し替え
6) Rollback
   - 実装PR を revert（必要なら）

## Delivery Recovery（reserved/in-flight 詰まり対応）
対象: `notification_deliveries/{deliveryId}` が `reserved` のまま残り、再実行が skip され続けるケース。

原則:
- 二重送信ゼロを優先するため、既定回復は `seal` のみ（再送しない）。
- `deliveryId` が `delivered=true` の場合は recovery 対象外。

手順:
1) `/admin/master` の「Delivery Recovery（seal）」で `deliveryId` を入力
2) `status` で現状確認（`delivered/sealed/state/lastError`）
3) `plan` 実行（planHash/confirmToken 取得）
4) `execute(seal)` 実行（confirmToken 必須）
5) `status` 再確認で `sealed=true` を確認
6) trace search で `delivery_recovery.plan` / `delivery_recovery.execute` を確認

期待結果:
- `sealed=true` の delivery は以後の送信で skip される
- 監査ログに traceId 付きで回復操作が残る

## Delivery deliveredAt Backfill（運用データ補完）
対象: `notification_deliveries` のうち `delivered=true` だが `deliveredAt` が欠損している旧データ。

原則:
- `sentAt` から `deliveredAt` を補完できる行のみ更新する。
- `sentAt` も欠損している行はスキップ（手動調査対象）。
- 危険操作なので `plan -> confirmToken -> execute` 必須。

手順:
1) `/admin/master` の「Delivery deliveredAt Backfill」で `limit` を指定（既定: 200）
2) `status` で `missingDeliveredAtCount / fixableCount / unfixableCount` を確認
3) `plan` 実行（planHash/confirmToken 取得）
4) `execute(backfill)` 実行（confirmToken 必須）
5) `status` 再確認で `missingDeliveredAtCount` が減っていることを確認
6) trace search で `delivery_backfill.plan` / `delivery_backfill.execute` を確認

期待結果:
- `deliveredAt` 欠損行のうち `sentAt` がある行が補完される
- `deliveredAtBackfilledAt / deliveredAtBackfilledBy` が追記される
- 監査ログに traceId 付きで実行結果が残る

## Evidence (監査証跡)
最低限、以下が traceId から取得できること。

- audits: view / plan / execute / kill switch set
- decisions: submit / execute（該当する場合）
- timeline: DECIDE / EXECUTE（該当する場合）
