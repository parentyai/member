# PHASE200_PLAN

## 目的
判断支援型UIの共通骨格（上部カードナビ + 下部パネル3層）を導入し、目的文/色意味/パンくず文言をSSOT化する。

## Scope IN
- 管理UIの共通レイアウト（カード/パネル）の追加
- 目的文/色意味/パンくず/共通ラベルの辞書 add-only
- SSOT_ADMIN_UI_OS のUI構造追記（add-only）

## Scope OUT
- read-modelロジック変更
- API変更
- 数値ロジック/色判定の自動化

## Target Files
- `apps/admin/*.html`
- `src/index.js`（/admin/login の目的文のみ）
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `docs/SSOT_ADMIN_UI_OS.md`
- `docs/PHASE200_EXECUTION_LOG.md`

## Acceptance / Done
- 各画面に目的文ブロックが存在する
- 上部カードナビ + 下部パネル3層が全画面に存在する
- 目的文/色意味/パンくず文言が辞書に add-only で存在する
- `npm run test:docs` PASS
- working tree CLEAN

## Verification
- `npm run test:docs`

## Evidence
- `docs/PHASE200_EXECUTION_LOG.md`
- `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase200.log`
