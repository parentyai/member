# 管理UI辞書（日本語）

更新日: 2026-02-15

この文書は管理UIの用語・画面・状態を非エンジニア向けに整理した辞書。
本書は管理UI表示の唯一SSOTであり、画面名/見出し/状態は本書に準拠する。
Admin_UI_Master_Dictionary v2.0 はリポジトリ/全ブランチ/履歴で未検出（所在確認結果は末尾）。

## 画面一覧（運用担当が使う画面）
| 画面 | ルート | できること | 根拠 |
|---|---|---|---|
| 運用判断支援（Ops Console / READ ONLY） | `/admin/ops` | 停止・追跡・再試行・セグメント送信 | `/Users/parentyai.com/Projects/Member/apps/admin/ops_readonly.html:6-22` |
| 通知作成（Composer / 運用OS） | `/admin/composer` | 作成→承認→送信 | `/Users/parentyai.com/Projects/Member/apps/admin/composer.html:6-30` |
| 配信結果（Monitor / READ ONLY） | `/admin/monitor` | 反応/CTRの閲覧 | `/Users/parentyai.com/Projects/Member/apps/admin/monitor.html:6-28` |
| エラー一覧（Errors / READ ONLY） | `/admin/errors` | WARN/Retryの閲覧 | `/Users/parentyai.com/Projects/Member/apps/admin/errors.html:6-25` |
| 設定/回復（Master / 運用OS） | `/admin/master` | 上限/自動実行/回復 | `/Users/parentyai.com/Projects/Member/apps/admin/master.html:6-30` |
| 通知集計（Read Model / READ ONLY） | `/admin/read-model` | 通知集計の閲覧 | `/Users/parentyai.com/Projects/Member/apps/admin/read_model.html:6-16` |
| 運用レビュー記録（Review） | `/admin/review` | 手動レビュー記録 | `/Users/parentyai.com/Projects/Member/apps/admin/review.html:6-17` |
| Admin Login | `/admin/login` | 管理トークン入力 | `/Users/parentyai.com/Projects/Member/src/index.js:370-388` |

## 操作のガード（事故防止）
- 危険操作（送信/停止/回復）は confirmToken 必須
- Kill Switch は最終停止装置

根拠:
- `/Users/parentyai.com/Projects/Member/docs/SSOT_ADMIN_UI_OS.md:12-17`
- `/Users/parentyai.com/Projects/Member/apps/admin/ops_readonly.html:41-55`

## 通知の状態（状態一覧）
- テンプレート状態: `draft` / `active` / `inactive`
- テンプレートVersion状態: `draft` / `active` / `archived`
- 通知状態: `draft` / `active` / `sent`
- 再試行キュー状態: `PENDING` / `DONE` / `GAVE_UP`

根拠:
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/notificationTemplatesRepo.js:9-123`
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/templatesVRepo.js:9-79`
- `/Users/parentyai.com/Projects/Member/src/routes/admin/osNotifications.js:33-106`
- `/Users/parentyai.com/Projects/Member/src/usecases/notifications/sendNotification.js:192-195`
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/sendRetryQueueRepo.js:6-89`

## 通知カテゴリ（種類）
- `DEADLINE_REQUIRED`
- `IMMEDIATE_ACTION`
- `SEQUENCE_GUIDANCE`
- `TARGETED_ONLY`
- `COMPLETION_CONFIRMATION`

根拠:
- `/Users/parentyai.com/Projects/Member/src/domain/notificationCategory.js:3-21`
- `/Users/parentyai.com/Projects/Member/docs/SSOT_NOTIFICATION_PRESETS.md:28-35`

## シナリオ/ステップ（通知の対象区分）
- scenarioKey: `A` / `C`
- stepKey: `3mo` / `1mo` / `week` / `after1w`

根拠:
- `/Users/parentyai.com/Projects/Member/apps/admin/composer.html:54-67`

## ログ/追跡（調査に使う項目）
- audit_logs: `actor`, `action`, `entityType`, `entityId`, `traceId`, `requestId`, `payloadSummary`, `createdAt`
- decision_logs: `subjectType`, `subjectId`, `decidedAt`, `traceId`
- decision_timeline: `lineUserId`, `source`, `action`, `createdAt`, `traceId`
- notification_deliveries: `state`, `delivered`, `sentAt`, `deliveredAt`, `lastError`

根拠:
- `/Users/parentyai.com/Projects/Member/docs/DATA_MAP.md:40-67`
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/auditLogsRepo.js:11-31`
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/decisionLogsRepo.js:12-21`
- `/Users/parentyai.com/Projects/Member/src/repos/firestore/decisionTimelineRepo.js:11-33`

## UIラベル（運用構造の可視化）
- 運用構造スナップショット: 通知のカテゴリ/ステップ/抑制/頻度/証跡をまとめた固定表示枠
- 待機方式（型）: TYPE_A（固定日数）/ TYPE_B（基準日+相対日）/ TYPE_C（状態遷移）
- waitRuleType: 待機方式（型）
- 次通知までの待機日数: SSOT未入力時は「未設定（SSOT未入力）」と表示
- 通知ID（notificationId）: 通知の一意ID表示
- title: 通知タイトル
- id: 通知ID（一覧の短縮ラベル）
- scenario: シナリオ表示
- step: ステップ表示
- scenario/step: シナリオとステップの併記
- 配信健全性（health）: OK/WARN/DANGER の健全性指標
- notificationHealth: 配信健全性（health）
- CTR: クリック率（%）
- delivered/read/click: 配信/既読/クリックの件数表示
- 対象人数 / 上限: plan audit の count と target.limit を併記
- 抑制条件: quietHours / 重複抑制 / legacy count の可視化
- 頻度上限: perUserWeekly / perUserDaily / perCategoryWeekly / quietHours の可視化
- 頻度上限（設定値ベース）: 設定値のみを表示（実カウントは含まない）
- 頻度上限は設定値ベース（実カウントは含まない）: UI注記
- Policy 判定: notificationPolicy の allowed/reason/allowedCategories を可視化
- 警告: policy_not_configured: Policy未設定の警告表示
- Tracking: TRACK_BASE_URL + TRACK_TOKEN_SECRET の有効判定
- 通知送信ブロック（最新）: notifications.send.execute の audit summary 表示
- Policy / Caps: system config（servicePhase/notificationPreset/notificationCaps）を表示
- Readiness: overallDecisionReadiness のステータス/ブロッキングを表示
- postCheck: decision_timeline POSTCHECK の結果サマリ
- AI提案: LLM提案（自動実行はしない）

根拠:
- `/Users/parentyai.com/Projects/Member/apps/admin/composer.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/monitor.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/read_model.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/errors.html`
- `/Users/parentyai.com/Projects/Member/apps/admin/ops_readonly.html`

## Admin_UI_Master_Dictionary v2.0 の所在確認結果
- 検索1: `rg -n "Admin_UI_Master_Dictionary" /Users/parentyai.com/Projects/Member/docs` → 未検出
- 検索2: `rg -n "Admin_UI_Master_Dictionary" /Users/parentyai.com/Projects/Member` → 未検出
- 検索3: `git grep -n "Admin_UI_Master_Dictionary" $(git rev-list --all)` → 未検出

<!-- ADMIN_UI_ROUTES_BEGIN -->
[
  {"route":"/admin/ops","screen":"運用判断支援（Ops Console / READ ONLY）","uiFile":"apps/admin/ops_readonly.html"},
  {"route":"/admin/composer","screen":"通知作成（Composer / 運用OS）","uiFile":"apps/admin/composer.html"},
  {"route":"/admin/monitor","screen":"配信結果（Monitor / READ ONLY）","uiFile":"apps/admin/monitor.html"},
  {"route":"/admin/errors","screen":"エラー一覧（Errors / READ ONLY）","uiFile":"apps/admin/errors.html"},
  {"route":"/admin/master","screen":"設定/回復（Master / 運用OS）","uiFile":"apps/admin/master.html"},
  {"route":"/admin/read-model","screen":"通知集計（Read Model / READ ONLY）","uiFile":"apps/admin/read_model.html"},
  {"route":"/admin/review","screen":"運用レビュー記録（Review）","uiFile":"apps/admin/review.html"},
  {"route":"/admin/login","screen":"Admin Login","uiFile":null}
]
<!-- ADMIN_UI_ROUTES_END -->

<!-- ADMIN_UI_TEXTS_BEGIN -->
{
  "/admin/ops": {
    "title": "運用判断支援（Ops Console / READ ONLY）",
    "h1": "運用判断支援（Ops Console / READ ONLY）",
    "h2": [
      "Operations（安全操作）",
      "Trace Search（監査）",
      "ユーザー状態一覧（READ ONLY）",
      "通知状態一覧",
      "Ops Dashboard（参考）",
      "Ops Console（一覧）",
      "Ops Console 詳細",
      "Segment Send（Plan / Execute）",
      "再試行キュー（READ ONLY + Manual Retry）",
      "memberNumber 未入力（14日超）",
      "Last reviewed",
      "Implementation Targets"
    ]
  },
  "/admin/composer": {
    "title": "通知作成（Composer / 運用OS）",
    "h1": "通知作成（Composer / 運用OS）",
    "h2": ["Draft", "Plan / Execute（Danger）"]
  },
  "/admin/monitor": {
    "title": "配信結果（Monitor / READ ONLY）",
    "h1": "配信結果（Monitor / READ ONLY）",
    "h2": []
  },
  "/admin/errors": {
    "title": "エラー一覧（Errors / READ ONLY）",
    "h1": "エラー一覧（Errors / READ ONLY）",
    "h2": [
      "Summary",
      "WARN Links (link_registry.lastHealth.state == WARN)",
      "Retry Queue (pending)"
    ]
  },
  "/admin/master": {
    "title": "設定/回復（Master / 運用OS）",
    "h1": "設定/回復（Master / 運用OS）",
    "h2": [
      "Templates（通知テンプレ）",
      "Link Registry（リンク管理）",
      "Redacクラブ会員ID（例外解除）",
      "Redac Health（運用確認）",
      "System Config（SSOT）",
      "Automation Config（Segment Execute Guard）",
      "Delivery Recovery（seal）",
      "Delivery deliveredAt Backfill"
    ]
  },
  "/admin/read-model": {
    "title": "通知集計（Read Model / READ ONLY）",
    "h1": "通知集計（Read Model / READ ONLY）",
    "h2": []
  },
  "/admin/review": {
    "title": "運用レビュー記録（Review）",
    "h1": "運用レビュー記録（Review）",
    "h2": []
  }
}
<!-- ADMIN_UI_TEXTS_END -->

<!-- NOTIFICATION_STATUSES_BEGIN -->
{
  "notificationTemplates": ["draft", "active", "inactive"],
  "templatesV": ["draft", "active", "archived"],
  "notifications": ["draft", "active", "sent"],
  "retryQueue": ["PENDING", "DONE", "GAVE_UP"]
}
<!-- NOTIFICATION_STATUSES_END -->

<!-- NOTIFICATION_CATEGORIES_BEGIN -->
["DEADLINE_REQUIRED", "IMMEDIATE_ACTION", "SEQUENCE_GUIDANCE", "TARGETED_ONLY", "COMPLETION_CONFIRMATION"]
<!-- NOTIFICATION_CATEGORIES_END -->

<!-- LOG_FIELDS_BEGIN -->
{
  "audit_logs": ["actor", "action", "entityType", "entityId", "traceId", "requestId", "payloadSummary", "createdAt"],
  "decision_logs": ["subjectType", "subjectId", "decidedAt", "traceId"],
  "decision_timeline": ["lineUserId", "source", "action", "createdAt", "traceId"],
  "notification_deliveries": ["state", "delivered", "sentAt", "deliveredAt", "lastError"]
}
<!-- LOG_FIELDS_END -->
