# UI_MIGRATION_AND_ROLLBACK_PLAN

更新日: 2026-03-07

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
6. PR6: 監査成果物整備（inventory/registry/matrix補完）

## ゲート
各PRで必須:
- `npm run test:docs`
- `npm run test:admin-nav-contract`

PR3以降:
- `npm test`

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
