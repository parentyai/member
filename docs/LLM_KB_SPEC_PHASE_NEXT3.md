# LLM + KB 統合仕様 — Phase Next-3

## 概要

Phase Next-3 では「guide-only モード解禁のための consent UI + lawfulBasis 整備」を実施した。
advisory-only / disabled by default / killSwitch 分離 は変更しない。

---

## 1. Consent 管理 API

専用エンドポイントを追加し、`llmPolicy.consentVerified` を plan/confirmToken サイクルなしで操作できるようにした。
管理者認証（`ADMIN_OS_TOKEN`）は既存ミドルウェアで保護済み。

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/api/admin/llm/consent/status` | 現在の consent 状態と guideModeLocked を返す |
| `POST` | `/api/admin/llm/consent/verify` | `consentVerified = true` に設定（`lawfulBasis === 'consent'` のみ許可） |
| `POST` | `/api/admin/llm/consent/revoke` | `consentVerified = false` に設定（常に許可） |

### consent/verify のガード

- `lawfulBasis !== 'consent'` の場合は `HTTP 409` + `{ ok: false, reason: 'lawful_basis_not_consent' }`
- 状態は変更しない（fail-closed）

### レスポンス例（/consent/status）

```json
{
  "ok": true,
  "lawfulBasis": "consent",
  "consentVerified": false,
  "consentRequired": true,
  "guideModeLocked": true
}
```

---

## 2. Guide Mode ロック/解除フロー

```
lawfulBasis = 'consent' に設定 (既存の /api/admin/llm/config/set)
      ↓
POST /api/admin/llm/consent/verify
      ↓
consentVerified = true → guideModeLocked = false
      ↓
getOpsExplanation / getNextActionCandidates の consent_missing ブロックが解除
```

### isConsentMissingByPolicy ロジック（変更なし）

```javascript
function isConsentMissingByPolicy(policy) {
  return Boolean(policy && policy.lawfulBasis === 'consent' && policy.consentVerified !== true);
}
```

- `lawfulBasis !== 'consent'` → LLM 使用可能（consent 不要）
- `lawfulBasis === 'consent'` && `consentVerified === false` → `consent_missing` ブロック
- `lawfulBasis === 'consent'` && `consentVerified === true` → LLM 使用可能

---

## 3. 監査ログ

| action | 発生タイミング |
|--------|--------------|
| `llm_consent.status.view` | GET consent/status |
| `llm_consent.verify` | POST consent/verify（成功・失敗両方） |
| `llm_consent.revoke` | POST consent/revoke |

payloadSummary に `lawfulBasis`, `consentVerified`, `ok` / `reason` を含める。

---

## 4. blockedReasonCategory マッピング

`consent_missing` → `CONSENT_MISSING`（既存の blockedReasonCategory.js に定義済み）

audit_logs の `payloadSummary.blockedReasonCategory` に `CONSENT_MISSING` が記録される。

---

## 5. 実装ファイル一覧

| ファイル | 変更種別 |
|----------|---------|
| `src/routes/admin/llmConsent.js` | 新規作成（consent status / verify / revoke ハンドラ） |
| `src/index.js` | consent ルート 3本追加 |
| `tests/phaseLLMNext3/phaseLLMNext3_consent_verify.test.js` | 新規作成（13テスト） |
| `tests/phaseLLMNext3/phaseLLMNext3_guide_mode_consent_gate.test.js` | 新規作成（8テスト） |

---

## 6. Next-4 予告

- **Phase Next-4**: consent UI → ユーザー向け同意フロー（LINE Webhook 経由での同意収集）
