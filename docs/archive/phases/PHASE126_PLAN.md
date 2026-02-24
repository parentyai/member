# PHASE126_PLAN

## Purpose
LINE配信メッセージ内リンクのクリックを「配信→クリック→SSOT（Firestore）→集計（phase18_cta_stats）→管理UI」で自然接続し、実運用レベルで回路を閉じる。

## Scope In
- track service（`SERVICE_MODE=track`）で `GET /t/{token}` を add-only で追加
- token は HMAC-SHA256 署名・期限つき（payload: `deliveryId`, `linkRegistryId`, `iat`, `exp`）
- best-effort 副作用:
  - `notification_deliveries.clickAt = serverTimestamp`
  - `phase18_cta_stats.clickCount += 1`（delivery→notificationId が辿れる範囲）
- 送信側は `TRACK_BASE_URL` + `TRACK_TOKEN_SECRET` がある場合のみ追跡URLを本文に付与（段階導入）
- 既存 `POST /track/click` 互換維持（削除・意味変更なし）

## Scope Out
- 既存APIレスポンスの互換破壊
- UI仕様変更
- LLM導入/実行自動化

## Done Definition
- `GET /t/{token}` で 302 redirect し、`clickAt` と `clickCount` が更新される（テストで担保）
- token 改ざん/期限切れが reject され、副作用が発生しない（テストで担保）
- `POST /track/click` が引き続き動作する（テストで担保）
- `npm test` PASS

## Rollback
- revert 実装PR

