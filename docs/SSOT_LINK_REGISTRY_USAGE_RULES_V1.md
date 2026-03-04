# SSOT_LINK_REGISTRY_USAGE_RULES_V1

Link Registryの利用境界と fail-close 条件を固定する add-only SSOT。

## 1. Registry Source of Truth

- 外部遷移先は `link_registry` のみを正規入力とする。
- 通知・クリック・previewは `linkRegistryId` 経由で解決する。

## 2. WARN Block Rules

- `link_registry.lastHealth.state === WARN` は fail-close。
- fail-close対象:
  - draft/create
  - preview
  - send/execute
  - track click (`/t/{token}` / `/track/click`)

## 3. Health Check Baseline

- `OK`: 送信可
- `WARN`: 送信不可（運用で解消後に再試行）
- `null/unknown`: 実装側で `WARN` 相当の保守運用を推奨（本契約は最低限 `WARN` を強制block）

## 4. Direct URL Forbidden

- 入力禁止:
  - `url` / `linkUrl` / `http(s)://...` の生入力
  - 短縮URLを含む `http(s)` 文字列全般
- 許可:
  - サーバ内部で `link_registry.url` を解決して使用する処理

## 5. Evidence and Audit

- 監査は `linkRegistryId` 単位で記録する。
- 生URLは payloadSummary に保存しない。
- kill-switch/cap/confirm の既存ガードは維持する。
