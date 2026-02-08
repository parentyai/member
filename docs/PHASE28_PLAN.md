# PHASE28_PLAN

## Phase28の目的
ops-console list に pagination 本実装を追加し、運用判断の一覧を安定して“次ページ”まで辿れる状態にする。
既存互換（nextPageToken/pageInfo）を維持しながら、cursor入力と整合する戻り値をSSOT化する。

## Scope In
- GET /api/phase26/ops-console/list の cursor 入力を追加（validation含む）
- pageInfo.hasNext / pageInfo.nextCursor を実データに基づき設定
- nextPageToken は pageInfo.nextCursor と整合する意味を固定
- ページングの重複なし/READY優先/required keys補完のテスト
- docs: PHASE28_PLAN / PHASE28_EXECUTION_LOG のSSOT追加

## Scope Out
- UI実装
- フィルタ追加（region/scenarioなど）
- データモデルの破壊的変更
- HMAC/署名付きcursor

## Top5（優先度順）
| Priority | 作業候補 | なぜ今やるのか | 何をやらない代わりか |
| --- | --- | --- | --- |
| 1 | cursor入力の導入とvalidation | paginationを本実装にするため | HMAC署名はしない |
| 2 | pageInfo/nextPageTokenの意味固定 | 互換を壊さずSSOT化するため | 既存キーの削除はしない |
| 3 | READY優先のページ跨ぎ保証 | 運用判断の優先順位を守るため | UI側の並び替えはしない |
| 4 | required keys補完の全ページ保証 | 欠落で運用が止まらないため | データ修復はしない |
| 5 | docs/EXECUTION_LOGの証跡固定 | “実装→証跡”を一本道にするため | 既存Phase改変はしない |

## Cursor仕様（SSOT）
- クエリ: `cursor`
- 形式: base64url(JSON)
  - JSON: { "s": "READY"|"NOT_READY", "t": "<ISO>"|null, "id": "<lineUserId>" }
- 無効なcursorは 400 (error: "invalid cursor")
- 並び順: READY優先 → cursorCandidate降順 → lineUserId昇順
- nextPageToken = pageInfo.nextCursor（互換キー）

## CLOSE条件（全てYESでCLOSE）
- PLAN exists: YES
- Top tasks implemented: YES
- tests added: YES
- npm test PASS: YES
- main CI PASS: YES
- docs append-only: YES

## 既存Phaseとの非改変宣言
- Phase27のlist挙動（READY優先・安定ソート・required keys補完）を保持
- Phase26の nextPageToken/pageInfo 互換を維持（削除・意味変更なし）
- Phase25/24/23 の判定ロジックは変更しない
