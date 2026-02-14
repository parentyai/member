# 管理運用マニュアル（日本語）

更新日: 2026-02-14
対象: 非エンジニア運用担当

A. この仕組みでできること（運用担当向け）
- お知らせを作る → 承認 → 送る
- 送信結果を確認する（既読/クリック/健康状態）
- 送信を止める（緊急停止）
- 送信数の上限を設定する（出しすぎ防止）
- 送信に失敗したものを再試行する

B. 画面の読み方（ホーム→作成→承認→送信→結果→安全→設定）
- ホーム（運用判断支援）: `/admin/ops`
  - 送信を止める、追跡番号（traceId）で調べる、失敗の再試行を行う
- 作成（通知作成）: `/admin/composer`
  - 作成 → 確認 → 承認 → 計画 → 送信
- 結果（配信の見える化）: `/admin/monitor`
  - 送った結果の一覧（読まれた/クリックされた など）
- エラー（失敗の一覧）: `/admin/errors`
  - リンクの警告、再試行待ちの一覧
- 安全・設定（運用OS）: `/admin/master`
  - 送信数の上限、送信の自動実行モード、回復操作（封印）
- 補助画面: `/admin/read-model`（通知集計） / `/admin/review`（レビュー記録）

C. よくある作業（手順化）
1. 「お知らせを出す」
- `/admin/composer` を開く
- Draft に必要事項を入力（title/body/cta/linkRegistryId/scenario/step/notificationCategory）
- 「Create Draft」→「Preview」→「Approve (active)」
- 「Plan Send」で planHash と confirmToken を取得
- 「Execute Send」で送信（confirmToken 必須）
- `/admin/monitor` で結果を確認

2. 「止める（緊急停止）」
- `/admin/ops` の「Operations（安全操作）」を開く
- 「plan ON」→ confirmToken を確認 →「set」
- 送信が止まる（Kill Switch）

3. 「ログで追う」
- `/admin/ops` の「Trace Search（監査）」で traceId を入力
- audits/decisions/timeline を確認する

D. 間違えやすいポイント
- 送信は必ず「plan → confirmToken → execute」の順番
- Kill Switch が ON のときは送信されない
- `stg` と `prod` は別。`prod` は手動承認が必要
- 追跡番号（traceId）は調査の主キー。操作のたびに控える

E. トラブル時
- 送れない/送られすぎ/苦情/誤送信は `docs/RUNBOOK_JA.md` を参照

F. 用語集（専門語を避けた説明）
- traceId: 追跡番号（操作の履歴を一括で追うための番号）
- planHash: 計画の指紋（同じ計画かを確認するための文字列）
- confirmToken: 最終確認コード（危険操作のときに必要）
- Kill Switch: 緊急停止スイッチ（送信を止める）
- delivery: 送信記録（誰に送ったかの記録）
- retry queue: 再試行待ち（失敗した送信の待機列）

## 根拠（パス/行）
- 画面一覧: `/Users/parentyai.com/Projects/Member/src/index.js:472-505`、`/Users/parentyai.com/Projects/Member/src/index.js:1675-1684`
- Ops画面の機能: `/Users/parentyai.com/Projects/Member/apps/admin/ops_readonly.html:41-348`
- Composer画面の流れ: `/Users/parentyai.com/Projects/Member/apps/admin/composer.html:30-114`
- Monitor画面: `/Users/parentyai.com/Projects/Member/apps/admin/monitor.html:28-66`
- Errors画面: `/Users/parentyai.com/Projects/Member/apps/admin/errors.html:25-58`
- Master画面: `/Users/parentyai.com/Projects/Member/apps/admin/master.html:111-241`
- Trace Search API: `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_TRACE_AUDIT.md:29-33`
- 送信/承認のAPI: `/Users/parentyai.com/Projects/Member/src/routes/admin/osNotifications.js:33-151`
- Deploy分離: `/Users/parentyai.com/Projects/Member/docs/RUNBOOK_DEPLOY_ENVIRONMENTS.md:11-139`
