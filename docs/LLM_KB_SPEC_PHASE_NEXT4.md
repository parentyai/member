# LLM + KB 統合仕様 — Phase Next-4

## 概要

Phase Next-4 では「ユーザー向け同意フロー（LINE Webhook 経由での同意収集）」を実施した。
LINE 会員が直接メッセージでAI機能への同意/拒否を表明できるようにした。
advisory-only / disabled by default / killSwitch 分離 は変更しない。

---

## 1. 追加コンポーネント

### 1-A. `src/repos/firestore/userConsentsRepo.js` — 新規作成

Firestore `user_consents` コレクションへのアクセス層。

| 関数 | 説明 |
|------|------|
| `setUserLlmConsent(lineUserId, accepted, version)` | 同意状態を upsert（`{ merge: true }`）|
| `getUserLlmConsent(lineUserId)` | 同意状態を取得。未存在なら `null` |

**保存フィールド:**

| フィールド | 型 | 説明 |
|---|---|---|
| `lineUserId` | string | LINE ユーザーID |
| `llmConsentStatus` | `'accepted'`\|`'revoked'`\|`'pending'` | 正規化済み同意状態 |
| `llmConsentVersion` | string | 同意バージョン（デフォルト: `llm_consent_v1`）|
| `llmConsentAcceptedAt` | Date\|null | 同意日時 |
| `llmConsentRevokedAt` | Date\|null | 拒否日時 |
| `updatedAt` | Date | 最終更新日時 |

### 1-B. `src/usecases/llm/recordUserLlmConsent.js` — 新規作成

ユーザー同意記録ユースケース。

```
recordUserLlmConsent(params, deps) → { ok, lineUserId, llmConsentStatus, llmConsentVersion }

params:
  lineUserId:      string (必須)
  accepted:        boolean (true=同意, false=拒否)
  consentVersion:  string (省略時: LLM_CONSENT_VERSION)
  traceId:         string|null
  actor:           string (省略時: 'line_user')

deps (DI):
  setUserLlmConsent: (lineUserId, accepted, version) → {...}
  appendAuditLog: (entry) → {...}
```

**監査ログ action:**
- 同意: `user_llm_consent.accept`
- 拒否: `user_llm_consent.revoke`

監査失敗は `.catch(() => null)` でベストエフォート処理（本体フローをブロックしない）。

### 1-C. `src/routes/webhookLine.js` — 変更

**追加したキーワードコマンド:**

| キーワード | 動作 | 返信 |
|---|---|---|
| `AI同意` | `recordUserLlmConsent({ accepted: true })` | `AI機能の利用に同意しました。` |
| `LLM同意` | `recordUserLlmConsent({ accepted: true })` | `AI機能の利用に同意しました。` |
| `AI拒否` | `recordUserLlmConsent({ accepted: false })` | `AI機能の利用への同意を取り消しました。` |
| `LLM拒否` | `recordUserLlmConsent({ accepted: false })` | `AI機能の利用への同意を取り消しました。` |

**処理順序（既存ハンドラとの関係）:**
1. LLM consent コマンド（新規・最優先）← ここで `continue`
2. `isRedacStatusCommand`（会員ID確認）
3. `declareRedacMembershipIdFromLine`
4. `declareCityPackFeedbackFromLine`
5. `declareCityRegionFromLine`

---

## 2. データモデル

### Firestore コレクション: `user_consents`

```
user_consents/{lineUserId}
  lineUserId:           string
  llmConsentStatus:     'accepted' | 'revoked' | 'pending'
  llmConsentVersion:    string   (e.g. 'llm_consent_v1')
  llmConsentAcceptedAt: Timestamp | null
  llmConsentRevokedAt:  Timestamp | null
  updatedAt:            Timestamp
```

- `{ merge: true }` による upsert — 既存フィールドを破壊しない
- `normalizeConsentStatus(value)`: 不正値は `'pending'` にフォールバック（fail-safe）

---

## 3. Done/Close 条件

- [x] `user_consents` コレクションへの upsert が動作する
- [x] `recordUserLlmConsent` が `user_llm_consent.accept` / `.revoke` を audit_logs に記録する
- [x] `AI同意` / `LLM同意` コマンドで `accepted=true` がセットされる
- [x] `AI拒否` / `LLM拒否` コマンドで `accepted=false` がセットされる
- [x] consent コマンドは `continue` で後続ハンドラへ fall-through しない
- [x] 監査ログ失敗でも Webhook は 200 を返す（ベストエフォート）
- [x] 864 テスト全グリーン

---

## 4. セキュリティ/プライバシー

| 観点 | 対応 |
|------|------|
| PII | `lineUserId` のみ。氏名・住所等は保存しない |
| 同意の証跡 | `llmConsentAcceptedAt` / `llmConsentRevokedAt` + audit_logs でトレーサブル |
| 同意バージョン | `llmConsentVersion` で将来の同意文書改定に対応可能 |
| 撤回 | `AI拒否` / `LLM拒否` でいつでも撤回可能 |
| fail-safe | 不正 `llmConsentStatus` 値は `'pending'` として読み込み（ACCEPTED扱いにならない） |
