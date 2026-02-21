# LLM_RUNBOOK

## Purpose
LLM 統合機能を advisory-only のまま安全に運用する。

## Stop / Start
1. LLM 機能停止（緊急）:
   - `/api/admin/llm/config/plan` + `/api/admin/llm/config/set` で `llmEnabled=false` を適用
   - 必要に応じて `LLM_FEATURE_FLAG=false` でデプロイ
2. LLM 機能再開:
   - `llmEnabled=true` + `LLM_FEATURE_FLAG=true` の両方を満たす
3. 停止後の確認:
   - FAQ API が `422 BLOCK` または fallback を返すこと
   - Ops/NextAction が fallback（rules）へ退避すること

## Audit / Trace
- audit_logs に以下の eventType が残ることを確認する。
  - `LLM_OPS_EXPLAIN`
  - `LLM_NEXT_ACTION_CANDIDATES`
  - `LLM_FAQ_ANSWER_GENERATED`
  - `LLM_FAQ_ANSWER_BLOCKED`
  - `LLM_DISCLAIMER_RENDERED`
- phase208 以降は action も確認する。
  - `llm_faq_answer_generated`
  - `llm_faq_answer_blocked`
  - `llm_ops_explain_generated`
  - `llm_ops_explain_blocked`
  - `llm_next_actions_generated`
  - `llm_next_actions_blocked`
  - `llm_disclaimer_rendered`
- traceId で追跡する場合は `/api/admin/trace?traceId=...` を使用する。
- `llm_disclaimer_rendered` の payloadSummary で `purpose` / `disclaimerVersion` / `disclaimerShown` を確認する。
- `llm_disclaimer_rendered` の payloadSummary で `surface`（`api` / `admin_ui`）を確認する。
- phase234 以降は以下の policy snapshot 項目も追跡する。
  - `lawfulBasis`
  - `consentVerified`
  - `crossBorder`
  - `blockedReasonCategory`
  - `fieldCategoriesUsed`
  - `policySnapshotVersion`
  - `regulatoryProfile`

## Failure Modes
- schema mismatch / citation mismatch / allow-list violation => fallback へ退避。
- provider timeout / error => fallback へ退避。
- FAQ で `kb_no_match` / `citations_required` / `direct_url_forbidden` / `warn_link_blocked` は 422 BLOCK。
- FAQ で `lawfulBasis=consent` かつ `consentVerified=false` の場合は `consent_missing` で 422 BLOCK。
- FAQ で `guideMode` が許可外の場合は `guide_only_mode_blocked` で 422 BLOCK。
- FAQ で personalization が許可外キーを含む場合は `personalization_not_allowed` で 422 BLOCK。

## LLM Policy Snapshot Operations (Phase234)
- status:
  - `GET /api/admin/llm/config/status`
  - `llmPolicy`（`lawfulBasis/consentVerified/crossBorder`）を確認
- plan:
  - `POST /api/admin/llm/config/plan`
  - body に `llmEnabled` と任意 `llmPolicy` を渡す
  - 返却 `planHash` は `llmEnabled + llmPolicy` の組で固定
- set:
  - `POST /api/admin/llm/config/set`
  - `planHash` と `confirmToken` が一致しない場合は `plan_hash_mismatch` / `confirm_token_mismatch`

## Notes
- killSwitch は LINE 送信停止用。LLM 停止は `llmEnabled` と `LLM_FEATURE_FLAG` の二重ゲートで行う。
- LLM は read-only / advisory-only。Firestore への自動書き込みや運用確定は禁止。

## Phase248 Add-only Taxonomy
- `blockedReasonCategory` の共通カテゴリ:
  - `NO_KB_MATCH`
  - `LOW_CONFIDENCE`
  - `DIRECT_URL_DETECTED`
  - `WARN_LINK_BLOCKED`
  - `SENSITIVE_QUERY`
  - `CONSENT_MISSING`
- 互換カテゴリ:
  - `GUIDE_MODE_BLOCKED`
  - `PERSONALIZATION_BLOCKED`
  - `CONTACT_SOURCE_REQUIRED`
  - `KB_SCHEMA_INVALID`
  - `LLM_API_ERROR`

---

## Phase Next-1 Ops

### LLM を有効化する手順
1. OPENAI_API_KEY を Secret Manager にセット（コードに書かない）
2. `LLM_FEATURE_FLAG=true` を App Engine / Cloud Run 環境変数にセット
3. `POST /api/admin/llm/config/set` `{ llmEnabled: true, lawfulBasis: '...', consentVerified: true, crossBorder: true }`
4. `GET /api/admin/llm/config/status` で `effectiveEnabled: true` を確認
5. `audit_logs` で `action='llm_faq_answer_blocked'` が減少していることを確認

### LLM を停止する手順（緊急時）
1. `POST /api/admin/llm/config/set` `{ llmEnabled: false }`
   → 即座に FAQ 回答が fallback に切り替わる
2. **注意**: `killSwitch` は LINE 送信停止専用。LLM 停止には使わない
3. `audit_logs` で `blockedReason='llm_disabled'` が記録されることを確認

### KB 記事管理
- `POST /api/admin/kb/articles` で記事作成（全必須フィールド要: status/riskLevel/version/validUntil/allowedIntents）
- `PATCH /api/admin/kb/articles/:id` でパッチ更新
- `DELETE /api/admin/kb/articles/:id` でソフトデリート（status='disabled'）
- `validUntil` は必ず設定すること（無期限は推奨しない）
- 既存記事の必須フィールド補完: `node tools/db_migrate_kb_required_fields.js --dry-run && node tools/db_migrate_kb_required_fields.js --apply`

### ロールバック手順
1. `POST /api/admin/llm/config/set` `{ llmEnabled: false }` で LLM を無効化
2. `LLM_FEATURE_FLAG` 環境変数を削除
3. `audit_logs` で `blockedReason='llm_disabled'` が記録されることを確認
