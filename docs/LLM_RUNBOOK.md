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
- phase234 以降は以下の policy snapshot 項目も追跡する。
  - `lawfulBasis`
  - `consentVerified`
  - `crossBorder`
  - `blockedReasonCategory`
  - `fieldCategoriesUsed`

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
