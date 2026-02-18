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
  {"route":"/admin/app","screen":"通知運用ダッシュボード（Linear UI）","uiFile":"apps/admin/app.html"},
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
      "安全操作",
      "監査検索",
      "通知テスト（検証 / 自己送信）",
      "ユーザー履歴（指定ユーザー）",
      "ユーザー状態一覧（参照のみ）",
      "通知状態一覧",
      "運用ダッシュボード（参考）",
      "運用判断一覧",
      "運用判断詳細",
      "セグメント送信（計画 / 実行）",
      "再送待ち（参照のみ）",
      "会員番号未入力（14日超）",
      "レビュー最終日",
      "実装対象"
    ]
  },
  "/admin/composer": {
    "title": "通知作成（Composer / 運用OS）",
    "h1": "通知作成（Composer / 運用OS）",
    "h2": ["下書き", "計画 / 実行（危険操作）"]
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
      "まとめ",
      "危険リンク一覧",
      "再送待ち一覧"
    ]
  },
  "/admin/master": {
    "title": "設定/回復（Master / 運用OS）",
    "h1": "設定/回復（Master / 運用OS）",
    "h2": [
      "通知テンプレ",
      "リンク管理",
      "Redacクラブ会員ID（例外解除）",
      "Redac運用確認",
      "システム設定（SSOT）",
      "自動化設定（実行ガード）",
      "配信回復（封印）",
      "配信補正（deliveredAt）"
    ]
  },
  "/admin/app": {
    "title": "通知運用ダッシュボード（Linear UI）",
    "h1": "通知運用ダッシュボード（Linear UI）",
    "h2": []
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

<!-- ADMIN_UI_DICT_BEGIN -->
{
  "ui.label.app.title": "通知運用ダッシュボード（Linear UI）",
  "ui.label.nav.title": "運用ナビ",
  "ui.label.nav.home": "ホーム",
  "ui.label.nav.compose": "通知配信",
  "ui.label.nav.monitor": "配信結果",
  "ui.label.nav.errors": "異常対応",
  "ui.label.nav.readModel": "通知集計",
  "ui.label.nav.audit": "証跡",
  "ui.label.nav.settings": "設定",
  "ui.label.nav.llm": "LLM支援",
  "ui.label.nav.maintenance": "回復・保守",
  "ui.label.top.todo": "今日の要対応",
  "ui.label.top.health": "状態内訳",
  "ui.label.top.anomaly": "直近の異常",
  "ui.desc.top.healthDefault": "要対応 0 / 注意 0 / 問題なし 0 / 未設定 0",
  "ui.label.role": "Role",
  "ui.label.role.operator": "運用者",
  "ui.label.role.admin": "管理者",
  "ui.label.summary.focus": "見るべき3点",
  "ui.label.summary.help": "迷ったら",
  "ui.label.summary.risk": "よくある失敗",
  "ui.label.panel.actions": "操作パネル",
  "ui.label.status.summary": "状態サマリー",
  "ui.label.status.todo": "今日の要対応",
  "ui.status.ok": "問題なし",
  "ui.status.warn": "注意",
  "ui.status.danger": "要対応",
  "ui.status.unknown": "未設定",
  "ui.desc.status.legend": "赤=要対応 / 黄=注意 / 緑=問題なし / 灰=未設定/不明",
  "ui.label.traceId": "追跡ID",
  "ui.help.traceId": "監査や操作結果の追跡に使うID",
  "ui.label.trace.regen": "再生成",
  "ui.label.common.empty": "データなし",
  "ui.label.scenario": "シナリオ",
  "ui.help.scenarioCode": "内部コード",
  "ui.help.stepCode": "内部コード",
  "ui.help.reasonCode": "理由コード",
  "ui.help.healthCode": "内部コード",
  "ui.value.scenario.A": "シナリオA",
  "ui.value.scenario.C": "シナリオC",
  "ui.value.step.3mo": "3か月前",
  "ui.value.step.1mo": "1か月前",
  "ui.value.step.week": "1週間前",
  "ui.value.step.after1w": "1週間後",
  "ui.metric.delta.ctr": "CTR",
  "ui.metric.delta.click": "クリック",
  "ui.metric.delta.read": "既読",
  "ui.metric.delta.sent": "送信",
  "ui.reason.unknown": "未分類の理由",
  "ui.reason.execute_missing": "未実行",
  "ui.reason.notification_cap_blocked": "上限で停止",
  "ui.reason.notification_policy_blocked": "ポリシーで停止",
  "ui.reason.kill_switch_on": "送信停止中",
  "ui.reason.plan_missing": "計画未作成",
  "ui.reason.plan_hash_mismatch": "計画不一致",
  "ui.reason.plan_mismatch": "計画不一致",
  "ui.reason.confirm_token_mismatch": "確認トークン不一致",
  "ui.reason.target_limit_required": "上限未設定",
  "ui.reason.no_recipients": "対象なし",
  "ui.reason.send_failed": "送信失敗",
  "ui.reason.execute_failed": "実行失敗",
  "ui.reason.ok": "実行成功",
  "ui.label.home.today": "今日の要対応",
  "ui.label.home.flow": "今日の流れ",
  "ui.label.home.detail": "対象の選択",
  "ui.desc.home.focus": "要対応 / 最優先通知 / 異常の主因",
  "ui.desc.home.help": "要対応から開く",
  "ui.desc.home.risk": "要対応を後回しにする",
  "ui.desc.home.flow1": "通知を作成/承認",
  "ui.desc.home.flow2": "対象と上限を確認",
  "ui.desc.home.flow3": "送信実行",
  "ui.desc.home.flow4": "結果と異常を確認",
  "ui.desc.home.flow5": "証跡を残す",
  "ui.desc.home.detail": "左ナビから配信/結果/異常を切り替え、右の操作パネルで実行します。",
  "ui.desc.home.actions": "最初に「通知配信」から着手するのが最短です。",
  "ui.metric.todo.count": "要対応件数",
  "ui.metric.todo.causes": "主因トップ3",
  "ui.metric.todo.anomaly": "直近の異常",
  "ui.desc.composer.focus": "目的 / 対象 / 確認トークン",
  "ui.desc.composer.help": "Planで対象数を確認",
  "ui.desc.composer.risk": "limit未設定でplanが弾かれる",
  "ui.label.composer.summary": "通知サマリー",
  "ui.label.composer.purpose": "目的",
  "ui.label.composer.target": "対象",
  "ui.label.composer.timing": "タイミング",
  "ui.label.composer.risk": "リスク",
  "ui.label.composer.status": "状態",
  "ui.label.composer.safety": "送信前安全チェック",
  "ui.label.composer.inputs": "通知入力",
  "ui.label.composer.title": "タイトル",
  "ui.label.composer.body": "本文",
  "ui.label.composer.cta": "ボタン文言",
  "ui.label.composer.link": "リンクID",
  "ui.label.composer.scenario": "シナリオ",
  "ui.label.composer.step": "ステップ",
  "ui.label.composer.category": "カテゴリ",
  "ui.label.composer.region": "地域（任意）",
  "ui.label.composer.limit": "上限件数（必須）",
  "ui.label.composer.membersOnly": "会員のみ",
  "ui.label.composer.membersAll": "全員",
  "ui.label.composer.create": "下書き作成",
  "ui.label.composer.preview": "プレビュー",
  "ui.label.composer.approve": "承認（有効化）",
  "ui.label.composer.plan": "送信計画",
  "ui.label.composer.execute": "送信実行",
  "ui.label.composer.planTarget": "対象人数（plan）",
  "ui.label.composer.planBlocked": "抑制数（plan）",
  "ui.label.composer.details": "詳細（内部キー）",
  "ui.label.composer.notificationId": "通知ID",
  "ui.label.composer.planHash": "計画ハッシュ",
  "ui.label.composer.confirmToken": "確認トークン",
  "ui.label.composer.countMode": "計数方式",
  "ui.label.composer.countSource": "計数元",
  "ui.label.composer.countStrategy": "計数戦略",
  "ui.label.composer.lastReason": "最終理由",
  "ui.desc.composer.actions": "下書き → 承認 → 計画 → 実行の順です。",
  "ui.desc.composer.titlePlaceholder": "例: 期限が近い方への案内",
  "ui.desc.composer.bodyPlaceholder": "本文を入力",
  "ui.desc.composer.ctaPlaceholder": "例: 詳細を見る",
  "ui.desc.composer.linkPlaceholder": "link registry のID",
  "ui.desc.composer.executeMeta": "計数方式: - / 計数元: - / 計数戦略: - / 最終理由: -",
  "ui.help.composer.title": "通知のタイトル",
  "ui.help.composer.body": "通知本文",
  "ui.help.composer.cta": "ボタンの表示文言",
  "ui.help.composer.link": "リンク管理に登録したID",
  "ui.help.composer.scenario": "通知シナリオの識別子",
  "ui.help.composer.step": "配信タイミングの識別子",
  "ui.help.composer.category": "通知カテゴリ",
  "ui.help.composer.region": "対象地域の絞り込み",
  "ui.help.composer.limit": "対象人数の上限",
  "ui.help.composer.membersOnly": "会員のみを対象にする",
  "ui.desc.composer.riskDefault": "Plan未実行",
  "ui.desc.composer.riskOk": "問題なし",
  "ui.desc.composer.riskBlocked": "抑制対象あり",
  "ui.desc.composer.riskFail": "Plan失敗",
  "ui.metric.composer.status": "直近操作の結果（作成/承認/計画/実行）",
  "ui.help.metric.composer.status": "操作の成功/失敗に基づく状態",
  "ui.desc.monitor.focus": "健康度 / 反応率 / 最終結果",
  "ui.desc.monitor.help": "要対応から開く",
  "ui.desc.monitor.risk": "状態未指定で全件を見てしまう",
  "ui.label.monitor.today": "今日の要対応",
  "ui.label.monitor.table": "配信結果（参照）",
  "ui.label.monitor.detail": "詳細",
  "ui.label.monitor.raw": "RAW JSON",
  "ui.label.monitor.reload": "更新",
  "ui.label.monitor.limit": "件数",
  "ui.label.monitor.status": "状態",
  "ui.label.monitor.scenario": "シナリオ",
  "ui.label.monitor.step": "ステップ",
  "ui.label.monitor.col.title": "タイトル",
  "ui.label.monitor.col.scenario": "シナリオ",
  "ui.label.monitor.col.step": "ステップ",
  "ui.label.monitor.col.target": "対象数",
  "ui.label.monitor.col.last": "最終結果",
  "ui.label.monitor.col.ctr": "反応率",
  "ui.label.monitor.col.health": "健康度",
  "ui.help.monitor.title": "通知タイトル",
  "ui.help.monitor.scenario": "通知シナリオ",
  "ui.help.monitor.step": "配信タイミング",
  "ui.help.monitor.target": "対象人数",
  "ui.help.monitor.last": "直近の実行結果",
  "ui.help.monitor.ctr": "クリック率",
  "ui.help.monitor.health": "健康状態",
  "ui.help.monitor.limit": "取得件数の上限",
  "ui.help.monitor.status": "通知の状態で絞り込み",
  "ui.desc.monitor.actions": "配信結果の取得条件を指定します。",
  "ui.metric.monitor.status": "通知単位の健康度集計（一覧表示分）",
  "ui.help.metric.monitor.status": "取得した一覧を集計",
  "ui.desc.errors.focus": "危険リンク / 再送待ち / まとめ",
  "ui.desc.errors.help": "再送待ちの最新から確認",
  "ui.desc.errors.risk": "再送を忘れて放置する",
  "ui.label.errors.recovery": "復旧パネル",
  "ui.label.errors.problems": "今ある問題",
  "ui.label.errors.recommend": "推奨アクション",
  "ui.label.errors.toOps": "Opsで復旧する",
  "ui.label.errors.summary": "まとめ",
  "ui.label.errors.warnLinks": "危険リンク一覧",
  "ui.label.errors.retryQueue": "再送待ち一覧",
  "ui.label.errors.linkId": "リンクID",
  "ui.label.errors.linkTitle": "タイトル",
  "ui.label.errors.linkUrl": "リンク先",
  "ui.label.errors.linkChecked": "最終確認",
  "ui.label.errors.queueId": "キューID",
  "ui.label.errors.lineUserId": "LINEユーザーID",
  "ui.label.errors.template": "テンプレ",
  "ui.label.errors.lastError": "最終エラー",
  "ui.label.errors.updatedAt": "更新日時",
  "ui.label.errors.reload": "更新",
  "ui.help.errors.linkId": "link_registry のID",
  "ui.help.errors.linkTitle": "通知タイトル",
  "ui.help.errors.linkUrl": "リンクURL",
  "ui.help.errors.linkChecked": "リンク確認日時",
  "ui.help.errors.queueId": "再送待ちID",
  "ui.help.errors.lineUserId": "対象ユーザー",
  "ui.help.errors.template": "通知テンプレート",
  "ui.help.errors.lastError": "直近の失敗理由",
  "ui.help.errors.updatedAt": "更新日時",
  "ui.desc.errors.actions": "危険リンクと再送待ちを確認します。",
  "ui.desc.errors.recommendWarn": "危険リンクを差し替え",
  "ui.desc.errors.recommendRetry": "再送待ちを確認",
  "ui.desc.errors.recommendNone": "問題なし",
  "ui.metric.errors.status": "危険リンク＋再送待ち件数（summary由来）",
  "ui.help.metric.errors.status": "危険リンク/再送待ちの件数",
  "ui.desc.readModel.focus": "要対応 / 反応率 / 最終結果",
  "ui.desc.readModel.help": "未取得がないか確認",
  "ui.desc.readModel.risk": "未取得を正常と誤解する",
  "ui.label.readModel.table": "通知集計（参照）",
  "ui.label.readModel.reload": "更新",
  "ui.label.readModel.col.title": "タイトル",
  "ui.label.readModel.col.scenario": "シナリオ",
  "ui.label.readModel.col.step": "ステップ",
  "ui.label.readModel.col.target": "対象数",
  "ui.label.readModel.col.last": "最終結果",
  "ui.label.readModel.col.ctr": "反応率",
  "ui.label.readModel.col.health": "健康度",
  "ui.help.readModel.title": "通知タイトル",
  "ui.help.readModel.scenario": "通知シナリオ",
  "ui.help.readModel.step": "配信タイミング",
  "ui.help.readModel.target": "対象人数",
  "ui.help.readModel.last": "直近の実行結果",
  "ui.help.readModel.ctr": "クリック率",
  "ui.help.readModel.health": "健康状態",
  "ui.desc.readModel.actions": "集計結果を取得します。",
  "ui.metric.readModel.status": "通知集計の健康度（一覧表示分）",
  "ui.help.metric.readModel.status": "取得した一覧を集計",
  "ui.desc.audit.focus": "traceId / 監査ログ / 操作結果",
  "ui.desc.audit.help": "traceIdを入力して検索",
  "ui.desc.audit.risk": "traceIdの誤入力",
  "ui.label.audit.search": "監査検索",
  "ui.label.audit.searchBtn": "検索",
  "ui.label.audit.detail": "詳細",
  "ui.desc.audit.actions": "traceIdで証跡を確認します。",
  "ui.desc.llm.focus": "lineUserId / FAQ質問 / 生成結果",
  "ui.desc.llm.help": "Ops説明から確認",
  "ui.desc.llm.risk": "lineUserId未入力で実行する",
  "ui.label.llm.validation": "LLM検証",
  "ui.label.llm.lineUserId": "LINEユーザーID",
  "ui.label.llm.question": "FAQ質問",
  "ui.label.llm.results": "結果",
  "ui.label.llm.opsExplain": "Ops説明",
  "ui.label.llm.nextActions": "次アクション候補",
  "ui.label.llm.faqAnswer": "FAQ回答",
  "ui.label.llm.policy": "運用ポリシー",
  "ui.label.llm.config": "LLM設定",
  "ui.label.llm.config.enabled": "LLM提案機能",
  "ui.label.llm.config.reload": "状態更新",
  "ui.label.llm.config.plan": "計画",
  "ui.label.llm.config.set": "適用",
  "ui.label.llm.config.status": "状態",
  "ui.label.llm.config.planResult": "計画結果",
  "ui.label.llm.config.setResult": "適用結果",
  "ui.label.llm.runOpsExplain": "Ops説明を取得",
  "ui.label.llm.runNextActions": "次候補を取得",
  "ui.label.llm.runFaq": "FAQ回答を生成",
  "ui.label.llm.openAudit": "証跡を開く",
  "ui.label.llm.block.title": "回答を停止しました",
  "ui.label.llm.block.reason": "停止理由",
  "ui.label.llm.block.actions": "代替アクション",
  "ui.label.llm.block.suggested": "候補FAQ",
  "ui.label.llm.block.action.open_official_faq": "公式FAQを見る",
  "ui.label.llm.block.action.open_contact": "問い合わせる",
  "ui.label.llm.block.action.unknown": "対応先を確認する",
  "ui.label.llm.block.reason.NO_KB_MATCH": "KB一致なし",
  "ui.label.llm.block.reason.LOW_CONFIDENCE": "根拠の信頼度不足",
  "ui.label.llm.block.reason.DIRECT_URL_DETECTED": "直接URLを検出",
  "ui.label.llm.block.reason.WARN_LINK_BLOCKED": "危険リンクを検出",
  "ui.label.llm.block.reason.SENSITIVE_QUERY": "機微情報を検出",
  "ui.label.llm.block.reason.CONSENT_MISSING": "同意未確認",
  "ui.label.llm.block.reason.UNKNOWN": "安全ルールで停止",
  "ui.help.llm.lineUserId": "対象ユーザーのLINE ID",
  "ui.help.llm.question": "KBに照会する質問",
  "ui.help.llm.config.enabled": "DBフラグの有効/停止を切り替えます",
  "ui.desc.llm.lineUserIdPlaceholder": "Uxxxxxxxx",
  "ui.desc.llm.questionPlaceholder": "例: 会員番号の確認方法は？",
  "ui.desc.llm.policy": "提案のみ。自動実行は行いません。最終判断は運用担当が実施します。",
  "ui.desc.llm.actions": "追跡IDを付けて実行し、結果を証跡として確認します。",
  "ui.desc.llm.block.none": "候補FAQはありません。",
  "ui.desc.llm.block.noActions": "代替アクションは未設定です。",
  "ui.value.llm.enabled": "有効",
  "ui.value.llm.disabled": "停止",
  "ui.confirm.llmConfigSet": "LLM設定を適用しますか？",
  "ui.desc.settings.focus": "通知テンプレ / リンク / System Config",
  "ui.desc.settings.help": "Masterへ移動",
  "ui.desc.settings.risk": "planなしでset",
  "ui.label.settings.notice": "設定は管理者で操作",
  "ui.label.settings.toMaster": "設定画面へ",
  "ui.desc.settings.notice": "設定・回復は /admin/master に集約されています。",
  "ui.desc.maintenance.focus": "回復 / 保守 / 監査",
  "ui.desc.maintenance.help": "Masterで確認",
  "ui.desc.maintenance.risk": "confirmToken未確認",
  "ui.label.maintenance.notice": "保守操作はMasterで実行",
  "ui.label.maintenance.toMaster": "回復画面へ",
  "ui.desc.maintenance.notice": "配信回復/補正は /admin/master に集約されています。",
  "ui.toast.monitor.ok": "monitor OK",
  "ui.toast.monitor.fail": "monitor 失敗",
  "ui.toast.readModel.ok": "read model OK",
  "ui.toast.readModel.fail": "read model 失敗",
  "ui.toast.errors.ok": "errors OK",
  "ui.toast.errors.fail": "errors 失敗",
  "ui.toast.composer.draftOk": "draft OK",
  "ui.toast.composer.draftFail": "draft 失敗",
  "ui.toast.composer.previewOk": "preview OK",
  "ui.toast.composer.previewFail": "preview 失敗",
  "ui.toast.composer.approveOk": "approve OK",
  "ui.toast.composer.approveFail": "approve 失敗",
  "ui.toast.composer.planOk": "plan OK",
  "ui.toast.composer.planFail": "plan 失敗",
  "ui.toast.composer.executeOk": "execute OK",
  "ui.toast.composer.executeFail": "execute 失敗",
  "ui.toast.composer.needId": "通知IDが必要です",
  "ui.toast.composer.needPlan": "計画ハッシュと確認トークンが必要です",
  "ui.toast.audit.fail": "audit 失敗",
  "ui.toast.llm.needLineUserId": "lineUserId を入力してください",
  "ui.toast.llm.needQuestion": "FAQ質問を入力してください",
  "ui.toast.llm.opsExplainOk": "Ops説明を取得しました",
  "ui.toast.llm.opsExplainFail": "Ops説明の取得に失敗しました",
  "ui.toast.llm.nextActionsOk": "次候補を取得しました",
  "ui.toast.llm.nextActionsFail": "次候補の取得に失敗しました",
  "ui.toast.llm.faqOk": "FAQ回答を生成しました",
  "ui.toast.llm.faqFail": "FAQ回答の生成に失敗しました",
  "ui.toast.llm.configStatusOk": "LLM設定状態を取得しました",
  "ui.toast.llm.configStatusFail": "LLM設定状態の取得に失敗しました",
  "ui.toast.llm.configPlanOk": "LLM設定の計画を作成しました",
  "ui.toast.llm.configPlanFail": "LLM設定の計画作成に失敗しました",
  "ui.toast.llm.configSetOk": "LLM設定を適用しました",
  "ui.toast.llm.configSetFail": "LLM設定の適用に失敗しました",
  "ui.toast.llm.configSetCanceled": "LLM設定の適用を中止しました",
  "ui.toast.llm.needConfigPlan": "設定計画が必要です",
  "ui.toast.llm.invalidEnabled": "LLM設定値が不正です",
  "ui.label.home.tasks": "今日やること",
  "ui.label.home.task.errors": "異常確認から開始",
  "ui.label.home.task.compose": "通知を作成・承認",
  "ui.label.home.task.monitor": "結果と証跡を確認",
  "ui.label.home.task.cityPack": "City Pack情報源を監査",
  "ui.desc.home.safeTest": "安全テストを実行すると、追跡ID付きで配信結果へ移動できます。",
  "ui.label.home.test.notificationId": "通知ID",
  "ui.label.home.test.lineUserId": "LINEユーザーID",
  "ui.label.home.test.mode": "テスト方式",
  "ui.label.home.test.run": "テスト実行（安全）",
  "ui.label.home.test.result": "テスト結果",
  "ui.help.home.test.notificationId": "テスト対象の通知ID",
  "ui.help.home.test.lineUserId": "自己送信時の対象LINEユーザーID",
  "ui.help.home.test.mode": "検証のみか自己送信かを選択",
  "ui.value.home.test.mode.dry": "検証のみ",
  "ui.value.home.test.mode.self": "自己送信",
  "ui.confirm.home.testSelfSend": "自己送信テストを実行しますか？",
  "ui.toast.home.testNeedNotificationId": "通知IDを入力してください",
  "ui.toast.home.testNeedLineUserId": "自己送信にはLINEユーザーIDが必要です",
  "ui.toast.home.testCanceled": "テストを中止しました",
  "ui.toast.home.testOk": "安全テストを実行しました",
  "ui.toast.home.testFail": "安全テストに失敗しました",
  "ui.label.composer.compare": "シナリオ比較",
  "ui.label.composer.compare.scenario": "シナリオ",
  "ui.label.composer.compare.count": "通知件数",
  "ui.label.composer.compare.avgCtr": "平均反応率",
  "ui.desc.composer.compare": "Read ModelからシナリオA/Cの通知件数と反応率を比較します。",
  "ui.label.monitor.userTimeline": "ユーザー別通知履歴",
  "ui.desc.monitor.userTimeline": "LINEユーザーIDまたは会員番号で、配信履歴を時系列で確認します。",
  "ui.label.monitor.userLineUserId": "LINEユーザーID",
  "ui.label.monitor.userMemberNumber": "会員番号",
  "ui.label.monitor.userLimit": "件数",
  "ui.label.monitor.userSearch": "履歴を検索",
  "ui.help.monitor.userLineUserId": "対象ユーザーのLINE ID",
  "ui.help.monitor.userMemberNumber": "会員番号でユーザーを検索",
  "ui.help.monitor.userLimit": "取得する履歴件数",
  "ui.label.monitor.userCol.sentAt": "送信日時",
  "ui.label.monitor.userCol.deliveryAt": "到達日時",
  "ui.label.monitor.userCol.user": "対象ユーザー",
  "ui.label.monitor.userCol.notification": "通知",
  "ui.label.monitor.userCol.status": "状態",
  "ui.label.monitor.userCol.failure": "送信できなかった理由",
  "ui.label.monitor.insights": "クリック分析（7日/30日）",
  "ui.desc.monitor.insights": "配信実績からベンダー別反応率、AB状況、FAQ参照Topを表示します。",
  "ui.label.monitor.windowDays": "集計期間",
  "ui.help.monitor.windowDays": "7日または30日で集計",
  "ui.value.monitor.window.7": "直近7日",
  "ui.value.monitor.window.30": "直近30日",
  "ui.label.monitor.insightsReload": "分析を更新",
  "ui.label.monitor.vendorCtr": "ベンダー別CTR Top",
  "ui.label.monitor.vendorCol.name": "ベンダー",
  "ui.label.monitor.vendorCol.sent": "送信",
  "ui.label.monitor.vendorCol.click": "クリック",
  "ui.label.monitor.vendorCol.ctr": "反応率",
  "ui.label.monitor.abFaq": "AB/FAQ状況",
  "ui.label.monitor.ab.vs": "vs",
  "ui.label.monitor.faqCol.article": "FAQ記事",
  "ui.label.monitor.faqCol.count": "参照回数",
  "ui.label.monitor.userTraceLink": "テスト結果を追跡する場合",
  "ui.label.monitor.openTrace": "追跡IDで証跡を開く",
  "ui.desc.monitor.abNone": "AB比較データはありません。",
  "ui.desc.monitor.safeNextStep": "次の安全な一手: 反応率が低い通知の詳細を確認する",
  "ui.toast.monitor.userQueryRequired": "LINEユーザーIDか会員番号を入力してください",
  "ui.toast.monitor.userLoaded": "ユーザー履歴を取得しました",
  "ui.toast.monitor.userLoadFail": "ユーザー履歴の取得に失敗しました",
  "ui.toast.monitor.insightsLoaded": "クリック分析を更新しました",
  "ui.toast.monitor.insightsLoadFail": "クリック分析の取得に失敗しました",
  "ui.label.errors.safeStep": "次にやる安全な1手",
  "ui.desc.errors.safeStepDefault": "更新を押して、最新の送信できなかった理由を確認する",
  "ui.desc.errors.safeStepWarn": "次にやる安全な1手: 危険リンク一覧を開いてリンク先を確認する",
  "ui.desc.errors.safeStepRetry": "次にやる安全な1手: 再送待ち一覧を開いて最新エラーを確認する",
  "ui.desc.errors.safeStepNone": "次にやる安全な1手: 更新を押して異常がないことを再確認する",
  "ui.label.nav.cityPack": "City Pack監査",
  "ui.desc.cityPack.focus": "期限切れ / 要確認 / 参照中の配信ルール",
  "ui.desc.cityPack.help": "Review InboxのConfirm候補から対応",
  "ui.desc.cityPack.risk": "期限切れ情報源の放置",
  "ui.label.cityPack.kpi": "City Pack監査KPI",
  "ui.metric.cityPack.expiredZeroRate": "expired sourceゼロ率",
  "ui.metric.cityPack.reviewLag": "review滞留時間",
  "ui.metric.cityPack.deadRate": "dead検出率",
  "ui.metric.cityPack.blockRate": "source起因ブロック率",
  "ui.label.cityPack.reviewInbox": "Review Inbox",
  "ui.desc.cityPack.reviewInbox": "情報源の有効期限と監査結果を確認し、Confirm / Retire / Replace / ManualOnly を実行します。",
  "ui.label.cityPack.statusFilter": "状態",
  "ui.help.cityPack.statusFilter": "情報源状態で一覧を絞り込み",
  "ui.value.cityPack.status.all": "すべて",
  "ui.value.cityPack.status.needsReview": "要確認",
  "ui.value.cityPack.status.active": "有効",
  "ui.value.cityPack.status.dead": "停止",
  "ui.value.cityPack.status.blocked": "手動対応",
  "ui.value.cityPack.status.retired": "廃止",
  "ui.label.cityPack.limit": "件数",
  "ui.help.cityPack.limit": "一覧の最大表示件数",
  "ui.label.cityPack.reload": "Inbox更新",
  "ui.label.cityPack.col.source": "source",
  "ui.label.cityPack.col.result": "result",
  "ui.label.cityPack.col.validUntil": "validUntil",
  "ui.label.cityPack.col.usedBy": "usedBy",
  "ui.label.cityPack.col.evidence": "evidence",
  "ui.label.cityPack.col.actions": "actions",
  "ui.label.cityPack.evidenceViewer": "Evidence Viewer",
  "ui.label.cityPack.evidence.compare": "スクリーンショット比較",
  "ui.label.cityPack.evidence.http": "HTTP情報",
  "ui.label.cityPack.evidence.diff": "差分要約（LLM補助）",
  "ui.label.cityPack.evidence.impacted": "影響CityPack一覧",
  "ui.label.cityPack.evidence.current": "今回",
  "ui.label.cityPack.evidence.previous": "前回",
  "ui.desc.cityPack.evidence.empty": "Inboxの行を選択すると証跡を表示します。",
  "ui.desc.cityPack.evidence.noDiff": "差分要約なし",
  "ui.desc.cityPack.evidence.noImpacted": "影響するCity Packはありません",
  "ui.desc.cityPack.actions": "監査ジョブの実行結果は追跡ID付きで保存されます。",
  "ui.label.cityPack.runMode": "監査モード",
  "ui.help.cityPack.runMode": "定期監査またはCanaryを選択",
  "ui.value.cityPack.runMode.scheduled": "定期監査",
  "ui.value.cityPack.runMode.canary": "Canary",
  "ui.label.cityPack.runAudit": "監査ジョブ実行",
  "ui.label.cityPack.runResult": "実行結果",
  "ui.label.cityPack.action.confirm": "Confirm",
  "ui.label.cityPack.action.retire": "Retire",
  "ui.label.cityPack.action.replace": "Replace",
  "ui.label.cityPack.action.manualOnly": "ManualOnly",
  "ui.desc.cityPack.safeStep": "次の安全な一手: Confirm候補を確認して期限を更新する",
  "ui.desc.cityPack.safeStepPrefix": "次にやる安全な一手",
  "ui.prompt.cityPack.replaceUrl": "置換先URLを入力してください",
  "ui.confirm.cityPack.runAudit": "City Pack監査ジョブを実行しますか？",
  "ui.toast.cityPack.inboxLoaded": "Review Inboxを取得しました",
  "ui.toast.cityPack.inboxLoadFail": "Review Inboxの取得に失敗しました",
  "ui.toast.cityPack.kpiLoaded": "City Pack KPIを更新しました",
  "ui.toast.cityPack.kpiLoadFail": "City Pack KPIの取得に失敗しました",
  "ui.toast.cityPack.replaceCanceled": "置換を中止しました",
  "ui.toast.cityPack.actionOk": "情報源ステータスを更新しました",
  "ui.toast.cityPack.actionFail": "情報源ステータス更新に失敗しました",
  "ui.toast.cityPack.runOk": "監査ジョブを実行しました",
  "ui.toast.cityPack.runFail": "監査ジョブの実行に失敗しました",
  "ui.label.readModel.definition": "この集計が示すもの",
  "ui.desc.readModel.definition": "直近の通知一覧について、送信結果と反応率をまとめた集計です。",
  "ui.label.readModel.summaryTip": "先に見る3項目",
  "ui.desc.readModel.tip1": "要対応（反応率が低い通知）",
  "ui.desc.readModel.tip2": "反応率",
  "ui.desc.readModel.tip3": "最終結果",
  "ui.desc.common.safeStepFallback": "次にやる安全な1手: 更新して最新状態を確認"
}
<!-- ADMIN_UI_DICT_END -->

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
