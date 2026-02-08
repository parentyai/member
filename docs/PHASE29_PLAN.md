# PHASE29_PLAN

## Phase29の目的
Phase28で追加した ops-console list pagination を「運用で迷わない形」に仕上げる。
互換性（既存レスポンスキー/意味）と Phase27/28で固定した挙動を保持しつつ、次ページ取得の運用導線と（任意の）改ざん耐性をSSOT化する。

## Scope In（最大2つ）
- A) UI統一: `nextPageToken` を次回リクエストの `cursor` にそのまま渡す運用を公式化（docs + guard tests）
- B) optional security: cursor署名（HMAC）を“後方互換”で追加（secret未設定時は従来通り）

## Scope Out
- C) コスト最適化（Firestore read削減/早期打ち切り戦略）
- UI実装（管理画面の変更）
- フィルタ追加（region/scenarioなど）
- cursor署名の強制（デフォルトでの破壊的なreject）

## Top5（優先度順）
| Priority | 作業候補 | なぜ今やるのか | 何をやらない代わりか |
| --- | --- | --- | --- |
| 1 | `nextPageToken -> cursor` の運用/例/テスト固定 | 運用導線を一本道にし、人間が迷わないようにするため | UI改修はしない |
| 2 | cursor署名（任意）とvalidationの追加 | token改ざんの検出を最小差分で導入するため | 署名強制はしない |
| 3 | 互換キー維持テストの強化 | 既存クライアント破壊を防ぐため | API shape変更はしない |
| 4 | docs/PLAN/EXECUTION_LOG のSSOT追加 | “実装→証跡→CLOSE”を固定するため | Runbook改変はしない |
| 5 | ロールバック手順（revert PR）明文化 | 1本で戻せる状態を担保するため | 細切れPRはしない |

## Pagination運用（SSOT）
- 次ページ取得:
  - response の `nextPageToken` を次回 request の `cursor` にそのまま渡す
  - `nextPageToken` と `pageInfo.nextCursor` は同じ意味/同値（互換キー）

## Cursor署名（SSOT / optional）
- token形式（署名付き）: `<payloadB64>.<sigB64>`
  - payloadB64: base64url(JSON)（Phase28と同じpayload）
  - sigB64: base64url(HMAC-SHA256(payloadB64))
- 署名secretが未設定の場合:
  - 従来通り unsigned cursor を生成/受理（既存互換）
  - 署名付きtokenを受け取った場合は payload 部分を解釈（検証は行わない）
- 署名secretが設定されている場合:
  - サーバは署名付きtokenを返す（`nextPageToken` / `pageInfo.nextCursor`）
  - 署名付きtokenを受け取った場合は署名検証し、不一致は 400 (error: "invalid cursor")
  - enforce ON の場合は unsigned cursor を 400 (error: "invalid cursor") でreject

## CLOSE条件（全てYESでCLOSE）
- PLAN exists: YES
- Top tasks implemented: YES
- tests added: YES
- npm test PASS: YES
- main CI PASS: YES
- docs append-only: YES

## 既存Phaseとの非改変宣言
- Phase27/28で固定したlist挙動（READY優先・安定ソート・required keys補完・cursor pagination）を保持
- Phase26の互換キー（`nextPageToken`, `pageInfo`）は削除せず、意味変更しない
- Phase25/24/23 の判定/基盤（Runbook/CI/判定ロジック）は変更しない

## 次フェーズへ送る事項（最大3つ）
- コスト最適化（Scope OutのC）: fetchLimit戦略/Firestore read削減は別フェーズで検討
