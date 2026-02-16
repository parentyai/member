# 管理UI辞書（日本語）

更新日: 2026-02-14

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

## 画面目的（Purpose）
<!-- ADMIN_UI_PURPOSES_BEGIN -->
{
  "/admin/ops": "運用判断を安全に確定し、証跡を確認する。",
  "/admin/composer": "通知を作成・承認し、送信計画を安全に実行する。",
  "/admin/monitor": "配信反応と健康状態を把握し、異常を見逃さない。",
  "/admin/errors": "WARN/Retryなどのエラーを素早く確認する。",
  "/admin/master": "運用設定と回復操作を安全に実行する。",
  "/admin/read-model": "通知集計を参照し、判断材料を得る。",
  "/admin/review": "運用レビュー記録を残す。",
  "/admin/login": "管理トークンで認証する。"
}
<!-- ADMIN_UI_PURPOSES_END -->

## UI共通ラベル
<!-- ADMIN_UI_PANEL_LABELS_BEGIN -->
{
  "purpose_title": "目的",
  "status_title": "状態サマリー",
  "action_title": "操作領域",
  "status_unknown": "未取得",
  "impact_target_count": "対象人数（plan）",
  "detail_title": "詳細",
  "week_over_week_label": "前週比（7日）",
  "plan_cap_blocked_count": "抑制数（plan）"
}
<!-- ADMIN_UI_PANEL_LABELS_END -->

## 状態ラベル（固定）
<!-- ADMIN_UI_STATUS_LABELS_BEGIN -->
{
  "status_ready": "READY",
  "status_not_ready": "NOT_READY",
  "health_ok": "OK",
  "health_warn": "WARN",
  "health_danger": "DANGER"
}
<!-- ADMIN_UI_STATUS_LABELS_END -->

## 色意味（固定）
<!-- ADMIN_UI_COLOR_RULES_BEGIN -->
[
  {"label":"赤","meaning":"要対応"},
  {"label":"黄","meaning":"注意"},
  {"label":"緑","meaning":"問題なし"},
  {"label":"灰","meaning":"未設定/不明"}
]
<!-- ADMIN_UI_COLOR_RULES_END -->

## パンくず（固定）
<!-- ADMIN_UI_BREADCRUMBS_BEGIN -->
{
  "format": "ページ名 / 対象ID / 詳細"
}
<!-- ADMIN_UI_BREADCRUMBS_END -->

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

## 通知集計/配信結果 表示項目（Read Model / Monitor）
- targetCount: 通知送信 plan で算出された対象人数
- targetCountSource: targetCount の出所（`plan_audit` / `plan_missing`）
- capCountMode: cap計数の方式（上限値ではない）
- capCountSource: cap計数の出所（上限値ではない）
- capCountStrategy: cap計数の戦略（上限値ではない）
- lastExecuteReason: 直近 execute の reason（未実行は `execute_missing`）

根拠:
- `/Users/parentyai.com/Projects/Member/src/usecases/adminOs/planNotificationSend.js:49-110`
- `/Users/parentyai.com/Projects/Member/src/usecases/adminOs/executeNotificationSend.js:40-360`
- `/Users/parentyai.com/Projects/Member/src/usecases/notifications/checkNotificationCap.js:19-170`
- `/Users/parentyai.com/Projects/Member/src/usecases/admin/getNotificationReadModel.js:1-200`

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
