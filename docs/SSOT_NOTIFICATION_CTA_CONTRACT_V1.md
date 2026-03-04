# SSOT_NOTIFICATION_CTA_CONTRACT_V1

LINE通知CTAの入力・解決・監査契約を固定する add-only SSOT。

## 1. Scope

- 対象: `plan -> execute -> send` 経路で送信される通知CTA。
- 既存互換: `ctaText + linkRegistryId` を primary として維持する。
- 拡張: `secondaryCtas[]` を add-only で追加する。

## 2. CTA Shape

```ts
type NotificationCtaContractV1 = {
  ctaText: string; // primary label
  linkRegistryId: string; // primary link id
  secondaryCtas?: Array<{
    ctaText: string;
    linkRegistryId: string;
  }>; // max 2
}
```

- CTA構成: `primary 1 + secondary <= 2`
- 合計上限: `<= 3`
- 最小: `>= 1`（CTA0は不可）

## 3. Type Rules

- `GENERAL`: max3
- `ANNOUNCEMENT`: max3
- `VENDOR`: max3
- `STEP`: max3
- `AB`: max3

## 4. Label Rules

- trim後 `1..20` 文字
- 改行不可
- 空不可
- 同一通知内で重複不可（大小無視）

## 5. Link Resolution

- 入力は `link_registry` のIDのみ許可。
- 送信時に全CTAの `linkRegistryId` を解決する。
- 未登録が1件でもあれば reject（fail-close）。
- `lastHealth.state === WARN` が1件でもあれば reject（fail-close）。

## 6. Direct URL Boundary

- 禁止対象（入力）:
  - Composer/API/LLM入力の `url` / `linkUrl` / `http(s)://...` 生値
  - `linkRegistryId` 欄への `http(s)` 直入力
- 許可対象（サーバ内部）:
  - `link_registry.url` を送信直前に解決し、LINE payloadの `uri` として使用

## 7. LINE Message Strategy

- `ENABLE_LINE_CTA_BUTTONS_V1=1` の場合:
  - LINE `Template Buttons` を優先
  - 条件不成立時は既存 `text` 送信へフォールバック
- `ENABLE_LINE_CTA_BUTTONS_V1=0` の場合:
  - 既存 `text` 送信のみ

## 8. Audit Keys（payloadSummary add-only）

- `ctaCount`
- `ctaLinkRegistryIds`
- `ctaLabelHashes`（ラベル平文は保存しない）
- `ctaLabelLengths`
- `lineMessageType`

禁止:
- 本文全文
- 生URL
- token/confirmToken

## 9. Feature Flags

- `ENABLE_NOTIFICATION_CTA_MULTI_V1`（既定0）
- `ENABLE_LINE_CTA_BUTTONS_V1`（既定0）
- `ENABLE_COMPOSER_AB_OPTION_V1`（既定0）

## 10. Backward Compatibility

- 既存通知（`secondaryCtas` 未保持）は従来どおり送信可能。
- `ctaText2` はプレビュー専用入力を維持（保存・送信非接続）。
