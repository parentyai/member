# UI_SCREENSHOT_EVIDENCE_LEDGER_V2

更新日: 2026-03-07

## 目的
Admin UI の before/after 視覚証跡を一元参照できるようにし、監査・回帰確認・PRレビュー時の根拠を固定する。

## 証跡ソース
- `artifacts/ui-audit-20260306/screenshots/*`（監査基準の before）
- `artifacts/ui-ux-audit-20260307/screenshots/*`（UX監査時の after）
- `artifacts/ui-audit-20260306/OBSERVED_COMMANDS.log`
- `artifacts/ui-ux-audit-20260307/console.log`

## 台帳ファイル
- `ui_screenshot_evidence_index_v2.json`

## カバレッジ要約
- 総件数: 35
- キャプチャセット: 2
  - `ui-audit-20260306`: 22
  - `ui-ux-audit-20260307`: 13
- ロール別
  - `admin`: 25
  - `operator`: 7
  - `developer`: 3
- Viewport別
  - `1440x900`: 28
  - `1280x800`: 3
  - `1024x768`: 3
  - `390x844`: 1
- サーフェス件数: 18

## 主要サーフェス証跡
- `UI-ADM-HOME`
- `UI-ADM-COMPOSER`
- `UI-ADM-MONITOR`
- `UI-ADM-CITY-PACK`
- `UI-ADM-VENDORS`
- `UI-ADM-READ-MODEL`
- `UI-ADM-SETTINGS`
- `UI-ADM-ALERTS`

## 未観測 / ギャップ
- inventory上の20サーフェスに対し、以下2サーフェスは本台帳にスクリーンショット未収録。
  - `UI-ADM-LOGIN`
  - `UI-ADM-LEGACY-COMPAT`

## 運用ルール
1. 新規UI変更PRでは、対応サーフェスの after スクリーンショットを `artifacts/*/screenshots/` に追加する。
2. 追加後に `ui_screenshot_evidence_index_v2.json` を更新し、`evidenceId` を採番する。
3. `sourceLog` には、観測コマンドを記録したログファイルを必ず紐づける。
4. 監査時は JSON 台帳を一次情報とし、Markdown は要約ビューとして使う。

## 参照手順
```bash
node -e "const a=require('./ui_screenshot_evidence_index_v2.json');console.log(a.length)"
node -e "const a=require('./ui_screenshot_evidence_index_v2.json');console.log([...new Set(a.map(x=>x.surfaceId))].sort())"
```
