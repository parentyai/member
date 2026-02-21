# LLM + KB 統合仕様 — Phase Next-2

## 概要

Phase Next-2 では「Ops 系 LLM ルート → llmClient 接続 + Ops テンプレ 3種完備」を実施した。
advisory-only / disabled by default / killSwitch 分離 は変更しない。

---

## 1. llmClient アダプタインターフェース拡張

`src/infra/llmClient.js` に以下のメソッドを追加した。

| メソッド | 呼び出し先 | 用途 |
|---------|-----------|------|
| `explainOps(payload)` | `callOpsExplain(payload, process.env)` | `getOpsExplanation` のアダプタ接続 |
| `suggestNextActionCandidates(payload)` | `callNextActionCandidates(payload, process.env)` | `getNextActionCandidates` のアダプタ接続 |

これにより `llmClient` が `deps.llmAdapter` として DI 注入できるアダプタインターフェースを満たす。

---

## 2. Ops ルートへの llmAdapter 注入

### 変更前
```javascript
// src/routes/admin/llmOps.js
async function handleAdminLlmOpsExplain(req, res) {
  const result = await getOpsExplanation({ ... });  // deps なし
}
```

### 変更後
```javascript
// src/routes/admin/llmOps.js
async function handleAdminLlmOpsExplain(req, res, deps) {
  const result = await getOpsExplanation({ ... }, deps);  // deps 経由で llmAdapter を受け取る
}

// src/index.js
await handleAdminLlmOpsExplain(req, res, { llmAdapter: llmClient });
await handleAdminLlmNextActions(req, res, { llmAdapter: llmClient });
```

---

## 3. Ops テンプレ 3種

Phase Next-2 完了時点で Ops 系レスポンスに 3種のテンプレートが揃う:

| テンプレート | バージョン | 内容 | 配置 |
|------------|----------|------|------|
| Ops 状態テンプレ | `ops_template_v1` | readiness / riskLevel / blockingReasons / proposal | `getOpsExplanation` レスポンスの `opsTemplate` |
| Ops ヘルステンプレ | `ops_health_template_v1` | notificationHealth / dangerFlags / mitigationSuggestion | `getOpsExplanation` レスポンスの `opsHealthTemplate` |
| Next Action テンプレ | `next_actions_template_v1` | currentState / missingItems / timeline / proposal | `getNextActionCandidates` レスポンスの `nextActionTemplate` |

### ops_health_template_v1 スキーマ

```json
{
  "templateVersion": "ops_health_template_v1",
  "notificationHealth": {
    "totalNotifications": number | null,
    "unhealthyCount": number | null,
    "countsByHealth": object | null
  },
  "dangerFlags": {
    "notReady": boolean,
    "staleMemberNumber": boolean
  },
  "mitigationSuggestion": string | null
}
```

---

## 4. DI フロー

```
index.js
  └─ handleAdminLlmOpsExplain(req, res, { llmAdapter: llmClient })
        └─ getOpsExplanation(params, { llmAdapter: llmClient })
              └─ callAdapter(llmClient, payload)
                    └─ llmClient.explainOps(payload)  ← 新規アダプタメソッド
                          └─ callOpenAi(payload, process.env)

index.js
  └─ handleAdminLlmNextActions(req, res, { llmAdapter: llmClient })
        └─ getNextActionCandidates(params, { llmAdapter: llmClient })
              └─ callAdapter(llmClient, payload)
                    └─ llmClient.suggestNextActionCandidates(payload)  ← 新規アダプタメソッド
                          └─ callOpenAi(payload, process.env)
```

---

## 5. 実装ファイル一覧

| ファイル | 変更種別 |
|----------|---------|
| `src/infra/llmClient.js` | `explainOps` / `suggestNextActionCandidates` メソッド追加 |
| `src/routes/admin/llmOps.js` | ハンドラに `deps` パラメータ追加 |
| `src/index.js` | Ops ハンドラに `{ llmAdapter: llmClient }` 注入 |
| `src/usecases/phaseLLM2/getOpsExplanation.js` | `buildOpsHealthTemplate` 追加 + レスポンスに `opsHealthTemplate` |
| `tests/phaseLLMNext2/` | 新規作成（3ファイル） |

---

## 6. フェールセーフ保証

- `deps.llmAdapter` が未注入 → `adapter_missing` エラーでフォールバック（LLM は使われない）
- LLM タイムアウト → `llm_timeout` でフォールバック
- LLM API エラー → `llm_api_error` でフォールバック
- いずれの場合も `ok: true` で構造化フォールバックレスポンスを返す

---

## 7. Next-3 予告

- **Phase Next-3**: guide-only モード解禁（consent UI + lawfulBasis 整備後）
