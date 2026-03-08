# SSOT_ROUTE_OUTCOME_CONTRACT_V1

目的: guard / kill-switch / partial / degraded の結果表現を route・job 間で統一する（add-only）。

## 1. 互換前提
- 既存の `ok` / `error` / status code は維持する。
- 互換維持のため、追加情報は `outcome` フィールドまたは `x-member-outcome-*` ヘッダで提供する。

## 2. Outcome state 定義
- `success`: 正常完了。
- `degraded`: 実行は継続したが guard read failure 等の劣化条件あり。
- `partial`: 一部成功/一部失敗（例: `partialFailure=true`）。
- `error`: 失敗。
- `blocked`: guard / kill-switch / auth 等で停止。

## 3. Outcome payload 契約
JSONレスポンスは以下を追加可能:

```json
{
  "outcome": {
    "state": "success|degraded|partial|error|blocked",
    "reason": "machine_readable_reason",
    "routeType": "public_write|admin_route|internal_job|webhook|unknown",
    "guard": {
      "routeKey": "string|null",
      "failCloseMode": "off|warn|enforce|null",
      "readError": true,
      "killSwitchOn": false,
      "decision": "allow|warn|block|null"
    }
  }
}
```

## 4. Header 契約
プレーンテキスト/redirect系 route は body 互換を維持し、必要に応じて以下ヘッダを返す:
- `x-member-outcome-state`
- `x-member-outcome-route-type`
- `x-member-outcome-reason`（reason がある場合のみ）

## 5. fail-close / fail-soft 境界
- `failCloseMode=enforce`: `blocked`（503/route既定の停止コード）。
- `failCloseMode=warn`: 実行継続し `degraded` を返す。
- `killSwitchOn=true`: `blocked` を返す。

## 6. 監査キー
audit payload summary に以下キーを追加可能:
- `outcomeState`
- `outcomeReason`
- `guardDecision`

## 7. 運用確認
- runbook では status code だけでなく `outcome.state` も確認対象にする。
- 監視で `ok=true` のみを成功判定に使わない。`degraded/partial` を別扱いにする。
