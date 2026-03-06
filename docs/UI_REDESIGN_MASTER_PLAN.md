# UI_REDESIGN_MASTER_PLAN

## 目的
Admin UI を運用者中心の導線へ段階置換し、判断速度・誤操作耐性・証跡追跡性を上げる。

## 実施方針
- 変更は add-only を優先し、既存 API / route 契約は維持する。
- 1PRごとに可逆（revert可能）な差分に分割する。
- 文言は `docs/ADMIN_UI_DICTIONARY_JA.md` をSSOTにする。
- `npm run test:docs` / `npm run test:admin-nav-contract` を必須ゲートにする。

## 実行フェーズ
1. PR0（完了）
- 禁止語防火壁
- URL / deep link / history 契約
- selector 契約
- success fixture 契約

2. PR1（この差分）
- グローバルシェル責務を固定
- 左ナビを業務単位 `dashboard/run/control/developer` に統合
- 旧重複ナビ群（notifications/users/catalog/communication/operations/legacy-nav）を撤去
- docs と nav契約テストを最新導線へ更新

3. PR2（次フェーズ）
- 状態表現の統一（badge / banner / inline / toast）
- `NOT AVAILABLE` の局所化
- empty / loading / error / success の表示整流

4. PR3
- 優先画面（Home / Composer / Users / City Pack / Vendors）の作業導線再編

5. PR4
- List + Detail / TableToolbar / RowAction を横断適用

6. PR5
- role可視性 / responsive / a11y hardening

## PR1 完了条件
- 左ナビが `dashboard/run/control/developer` の4系統で動作する。
- `settings` 導線が `nav-open-settings` に一本化される。
- `test:docs` と `test:admin-nav-contract` が通る。
- ロールバックは PR 単位で実行可能。

