# UI_COPY_GUIDELINES_JA_V2

更新日: 2026-03-06

## 目的
運用者（operator/admin）が画面だけで判断できるよう、文言を日本語中心で統一する。

## 基本方針
- 主文言は日本語。
- 1文を短く保つ。
- 操作結果は「何が起きたか」を先に書く。
- エラーは「何が起きたか + 次の行動」を明記する。

## 禁止語（operator/admin面）
- `pane`
- `rollout`
- `not available`
- `providerKey`

置換基準:
- `not available` -> `情報なし`
- `pane` -> `画面`
- `rollout` -> `段階公開`
- `providerKey` -> `提供元ID`

## メッセージ別テンプレート

### Toast（操作結果）
- 成功: `〜を更新しました`
- 注意: `〜が必要です`
- 失敗: `〜に失敗しました`

### Banner（画面上部）
- 原因: `原因: ...`
- 影響: `影響: ...`
- 操作: `操作: ...`

### Empty
- `データなし`
- 可能なら次操作を1つ明示する。

### Loading
- ローカル文言は短く。スケルトン併用を優先する。

### Error
- 生の英語エラーは表示しない（監査IDまたはtraceIdで追跡可能にする）。

## 監査時チェック
- 新規 `t('ui.*')` キーを導入した場合は `docs/ADMIN_UI_DICTIONARY_JA.md` の `ADMIN_UI_DICT` ブロックへ必ず追加する。
- `npm run test:docs` を通過させる。
