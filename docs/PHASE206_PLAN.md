# PHASE206_PLAN

## 目的
/admin/app を新設し、通知運用を1画面で完結させる「Linear UI」シェルを構築する。

## Scope IN
- /admin/app（シェル）新設
- Role Switch（UIのみ）
- 左ナビ + 上部バー + メインペイン + 右操作パネル
- Composer/Monitor/Errors/ReadModel の主要要素を pane 化
- UI文言を辞書参照（data-dict-key）に統一
- /admin/ui-dict で辞書を配布
- Phase206 実行ログの作成

## Scope OUT
- 既存API/ロジック変更
- 権限/認可の追加変更
- 外部UIライブラリ導入

## Target Files
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`
- `src/index.js`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `docs/PHASE206_EXECUTION_LOG.md`

## Acceptance / Done
- /admin/app が動作し、左ナビで pane 切替ができる
- Role Switch で admin 操作が非表示になる（UIのみ）
- 文言/tooltip が辞書キーで参照される
- `npm test` / `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `npm run test:docs`
- `npm test`

## Evidence
- `docs/PHASE206_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase206.log`
