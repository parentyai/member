# UI 禁止語ガイド V2

更新日: 2026-03-06

## 目的
運用者（operator/admin）向け画面に内部実装語が露出することを防ぐ。

## 適用範囲
- operator / admin: 適用
- developer: 参照目的のため一部除外可

## 禁止語（PR0時点）
- `pane`
- `rollout`
- `not available`
- `providerKey`

## 置換方針
- `not available` -> `情報なし`
- `pane` -> `画面`
- `rollout` -> `段階公開`
- `providerKey` -> `提供元ID`

## 実装境界
- 表示文言は `docs/ADMIN_UI_DICTIONARY_JA.md` と `apps/admin/assets/admin_app.js` の辞書解決経由を優先する。
- fallback文言は role別正規化を通す。

## CI契約
- `tests/phase674/phase674_t15_ui_banned_terms_contract.test.js`
