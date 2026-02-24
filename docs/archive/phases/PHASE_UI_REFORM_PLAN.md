# PHASE_UI_REFORM_PLAN

## Purpose
- 管理UIを「通知管理画面」から「運用OS（判断→操作→証跡→回復）」へ移行し、`/admin/ops` をハブURLに固定する。
- 運用導線画面（`/admin/app`）から状態サマリーを撤去し、判断はハブ上部カードへ集約する。
- Monitorでユーザー別履歴・ベンダー別CTR・AB/FAQ状況を参照できるようにする。

## 現状の運用者視点の問題点
- `apps/admin/app.html` の運用ペインに状態サマリーが残り、判断情報が重複している。
- `/admin/ops` と `/admin/app` が分離し、運用の入口が1つに固定されていない。
- Monitorで lineUserId/memberNumber を起点に通知履歴を追えない。
- テスト実行結果（traceId）から履歴確認への導線が弱い。
- クリック分析（vendor/AB/FAQ）がMonitorで一画面参照できない。

## Scope IN
- `/admin/ops -> /admin/app` リダイレクト。
- `/admin/app` の composer/monitor/errors/read-model から状態サマリーDOMを撤去。
- Monitorへユーザー別履歴UI + 分析UIを追加。
- API add-only:
  - `GET /api/admin/notification-deliveries`
  - `GET /api/admin/monitor-insights`
- `faq_answer_logs` の一覧取得repoをadd-only追加。
- 辞書 add-only 更新（`ui.*` ラベル/tooltip/説明）。
- phase241テスト追加と既存テスト調整（`/admin/ops` 挙動変更分）。

## Scope OUT
- 既存通知ロジック（confirm token / kill switch / validators）変更。
- DBスキーマ破壊的変更。
- `apps/admin/ops_readonly.html` の全面置換。

## 変更対象ファイル一覧
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`
- `src/index.js`
- `src/routes/admin/notificationDeliveries.js` (new)
- `src/routes/admin/monitorInsights.js` (new)
- `src/repos/firestore/faqAnswerLogsRepo.js`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `docs/archive/phases/PHASE_UI_REFORM_EXECUTION_LOG.md` (new)
- `tests/security/admin_os_token_required.test.js`
- `tests/phase241/*` (new)

## UI情報設計（Opsに集約する情報と理由）
- 集約先: `/admin/app` Top Bar + Home「今日やること」カード。
- 集約情報:
  - 要対応件数（DANGER件数）
  - 主因トップ3（lastExecuteReason頻度）
  - 直近異常（weekOverWeek悪化最大）
- 理由:
  - ペインごとの状態サマリーを廃止し、最初に見る判断情報を1か所へ固定するため。

## API差分（add-only）とテスト方針
- `GET /api/admin/notification-deliveries`
  - lineUserId/memberNumber で対象を解決し、時系列deliveryを返す。
  - vendor欠損は `link_registry.url` host で補完。
- `GET /api/admin/monitor-insights`
  - windowDays=7/30 の delivery集計から vendor CTR Top / ctrTop を返す。
  - ABは phase22 snapshot の期間内最新値、FAQは `matchedArticleIds` 頻度。
- テスト:
  - ルートリダイレクト、APIレスポンス、辞書整合、UI導線契約を `tests/phase241` に追加。
  - 既存セキュリティテストの `/admin/ops` 想定を新挙動へ更新。

## P-01〜P-10 対応方針
- P-01: `summary-header` 常設（`/admin/app` 各ペイン）。
- P-02: 運用ペインの状態サマリー撤去（composer/monitor/errors/read-model）。
- P-03: 表示語は運用語、内部語は `data-dict-tip` へ隔離。
- P-04: 操作は `action-panel` に順序固定。
- P-05: `today-card` + home task cards で重要3点強調。
- P-06: Monitorでユーザー別履歴検索API/UIを追加。
- P-07: Home安全テスト実行→traceId→Monitor導線を追加。
- P-08: `/admin/ops` をハブURL化（302 `/admin/app`）。
- P-09: Errors/Monitorに「次にやる安全な1手」を表示。
- P-10: token準拠の視覚階層（task card / safe step / active row / toast）。

## Verification
- `npm run test:docs`
- `npm test`
- `node --test tests/phase241/*.test.js`

## Rollback
- PR merge commit を `git revert`。
- 緊急時は `src/index.js` の `/admin/ops` リダイレクト差分のみ先にrevertして入口を戻す。
