# UI_MIGRATION_AND_ROLLBACK_PLAN

更新日: 2026-03-16

## 目的
Admin UI 再設計を PR 単位で段階移行し、問題時に即時ロールバック可能にする。

## 前提
- 変更は add-only を優先する。
- 既存 route/API 契約は維持する。
- 各PRは単独revert可能にする。

## 移行フェーズ
1. PR0: 防波堤（禁止語 / URL状態 / selector契約 / success fixture）
2. PR1: Global shell / nav再編
3. PR2: 状態表現・文言・通知階層統一
4. PR3: 優先画面（Home/Composer/Users/CityPack/Vendors）再編
5. PR4: Detail rail / Table toolbar / Saved view 強化
6. PR5: role/permission/responsive/a11y hardening
7. PR6: diagnostics/preflight/runtime/jobs の System隔離
8. PR7: visual system cleanup（foldノイズ縮退 + json collapse契約）
9. PR8: Data Reflection Reliability Contract（原因分類 + 次アクション統一）
10. PR9: target4 pane stabilization（monitor/audit/llm/settings）
11. PR10: login/preflight 運用摩擦削減
12. PR11: hardening + one-shot release gate（3role×14surface 回帰固定）

## ゲート
各PRで必須:
- `npm run test:docs`
- `npm run test:admin-nav-contract`

PR3以降:
- `npm test`

PR11追加ゲート:
- `node --test tests/phase674/*.test.js`
- `ui_screenshot_evidence_index_v2.json` に `ui-pr11-hardening-20260316` が 42件存在
- `docs/REPO_AUDIT_INPUTS/ui_pr11_fold_noise_role_surface_1440x900.json` が存在

## 即時停止手順
1. 問題PRのマージを停止する。
2. デプロイ前なら対象ブランチをfreezeする。
3. 監査ログ（traceId）を保存して原因を固定する。

## 段階ロールバック
1. 最新PRから逆順に `git revert <merge_commit>` を適用する。
2. 画面崩れのみなら CSS/HTML の当該コミットだけを先行revertする。
3. 文言のみの問題は辞書・copy差分のみrevertする。

## 完全ロールバック
1. PR5 → PR0 の順で merge commit をすべてrevertする。
2. route/API 契約は不変なのでバックエンド復旧手順は不要。
3. リリースを最後の安定タグへ戻す。

## One-shot 展開（PR8〜PR11）
### 展開前チェック
1. `npm run test:docs`
2. `npm run test:admin-nav-contract`
3. `node --test tests/phase674/*.test.js`
4. 14面×3ロールの証跡 (`ui-pr11-hardening-20260316`) を確認

### 即時停止
1. `ENABLE_OPS_SYSTEM_SNAPSHOT_V1=0`
2. `ENABLE_OPS_REALTIME_DASHBOARD_V1=0`
3. `ENABLE_ADMIN_NAV_ALL_ACCESSIBLE_V1=0`

### 段階ロールバック
1. `git revert <PR11 merge commit>`
2. `git revert <PR10 merge commit>`
3. `git revert <PR9 merge commit>`
4. `git revert <PR8 merge commit>`

## 破綻シナリオと検知
1. ナビ再編で到達不能
- 検知: `test:admin-nav-contract` の `resolveAllowedPane` 契約失敗
- 緩和: 旧導線aliasを再有効化

2. 状態統一で既存表示が崩壊
- 検知: `phase674` 状態/メッセージ契約テスト失敗
- 緩和: 旧class互換レイヤーを復帰

3. role制御でoperator導線喪失
- 検知: `phase644/phase674` role可視性契約失敗
- 緩和: `data-role-allow` を前版へ復旧

## データ影響
- Firestoreスキーマ変更: なし
- Firestore書き込み仕様変更: なし
- 既存API I/O契約変更: なし

## 運用メモ
- 各PRで before/after スクリーンショットを保存する。
- role別（operator/admin/developer）で同一導線を確認する。
- deep link / reload / back-forward を毎回回帰する。
