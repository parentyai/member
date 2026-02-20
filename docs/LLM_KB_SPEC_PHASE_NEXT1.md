# LLM + KB 統合仕様 — Phase Next-1

## 概要

Phase Next-1 では「安全強化 + FAQ改善」を実施した。
advisory-only / disabled by default / killSwitch 分離 は変更しない。

---

## 1. KB 記事必須属性スキーマ

KB 記事（コレクション: `faq_articles`）の write 時に以下フィールドを必須とする。

| フィールド | 型 | 備考 |
|----------|-----|------|
| `status` | `'active' | 'draft' | 'disabled'` | 検索は `active` のみ返す |
| `riskLevel` | `'low' | 'medium' | 'high'` | デフォルト値なし（必須） |
| `version` | semver 文字列 | `version` / `versionSemver` 少なくとも一方 |
| `validUntil` | ISO 日付 / Firestore Timestamp | 無期限は推奨しない |
| `allowedIntents` | 文字列配列 | `[]` = 全インテント許可 |

検索時: `riskLevel` / `allowedIntents` が null/undefined の記事は検索結果から除外する。

### 移行手順

既存記事への対応は以下のスクリプトを使用する:

```bash
# プレビュー
node tools/db_migrate_kb_required_fields.js --dry-run

# 実際に適用
node tools/db_migrate_kb_required_fields.js --apply
```

---

## 2. Admin KB 管理 API

| メソッド | パス | 説明 |
|--------|------|------|
| `GET` | `/api/admin/kb/articles` | 記事一覧（最大50件） |
| `POST` | `/api/admin/kb/articles` | 記事作成（schema validation 必須） |
| `PATCH` | `/api/admin/kb/articles/:id` | 記事部分更新 |
| `DELETE` | `/api/admin/kb/articles/:id` | ソフトデリート（`status: 'disabled'`） |

- 全エンドポイント: `ADMIN_OS_TOKEN` 認証必須（`/api/admin/` プレフィックスで自動保護）
- POST 失敗時: `HTTP 422` + `{ ok: false, error: 'kb_schema_invalid', errors: string[] }`
- 全操作: `audit_logs` に `actor` / `traceId` / `entityId` 付きで記録

---

## 3. LLM Client Adapter

ファイル: `src/infra/llmClient.js`

- OpenAI API (`/v1/chat/completions`) に対する HTTP adapter
- `OPENAI_API_KEY` 環境変数 / Secret Manager から読む（コードに書かない）
- `OPENAI_MODEL` 環境変数でモデル指定（デフォルト: `gpt-4o-mini`）
- `response_format: { type: 'json_object' }` で JSON 出力を強制
- flag チェックは行わない（usecase 層で制御済み）
- エクスポート: `answerFaq`, `callOpsExplain`, `callNextActionCandidates`

### DI 接続ポイント

`answerFaqFromKb(params, deps)` の `deps.llmAdapter` に注入する:

```javascript
const llmClient = require('./infra/llmClient');
await handleAdminLlmFaqAnswer(req, res, body, { llmAdapter: llmClient });
```

---

## 4. blockedReason taxonomy 拡張

`src/llm/blockedReasonCategory.js` に追加した 5 エントリ:

| blockedReason | カテゴリ | 発生ケース |
|--------------|---------|----------|
| `contact_source_required` | `CONTACT_SOURCE_REQUIRED` | riskLevel=high の KB記事に contact source 未引用 |
| `kb_schema_invalid` | `KB_SCHEMA_INVALID` | KB記事の必須フィールド欠如 |
| `llm_api_error` | `LLM_API_ERROR` | HTTP 非200 / 不正 JSON |
| `llm_timeout` | `LLM_API_ERROR` | LLM 応答タイムアウト |
| `adapter_missing` | `LLM_API_ERROR` | `deps.llmAdapter` が未注入 |

---

## 5. 実装ファイル一覧

| ファイル | 変更種別 |
|----------|---------|
| `src/infra/llmClient.js` | 新規作成 |
| `src/routes/admin/kbArticles.js` | 新規作成 |
| `tools/db_migrate_kb_required_fields.js` | 新規作成 |
| `tests/phaseLLMNext1/` | 新規作成（4ファイル） |
| `src/llm/blockedReasonCategory.js` | +5行追記 |
| `src/repos/firestore/faqArticlesRepo.js` | 関数追加 + 2行変更 |
| `src/routes/admin/llmFaq.js` を呼ぶ index.js 行 | +1行（llmAdapter 注入） |
| `src/index.js` | `/api/admin/kb/` ブロック追加 |

---

## 6. Next-2 / Next-3 予告

- **Phase Next-2**: `getOpsExplanation` / `getNextActionCandidates` → `llmClient` 接続、Ops テンプレ 3種
- **Phase Next-3**: guide-only モード解禁（consent UI + lawfulBasis 整備後）
