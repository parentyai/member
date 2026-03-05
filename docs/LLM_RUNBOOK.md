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

## Phase653 運用追記（Free/Pro 分離）
- Free (`plan=free`) は Retrieval のみ（`faq_search`）で運用する。  
- Pro (`active|trialing`) のみ LLM intent (`situation_analysis/gap_check/timeline_build/next_action_generation/risk_alert`) を許可する。  
- Proでも `budget/rate/outage/policy_disabled/template_violation/citation_missing` は Retrieval へ降格する。  
- `next_action` は alias として受理し、内部 canonical は `next_action_generation` とする。  

## LLM Usage 可視化
- `GET /api/admin/os/llm-usage/summary?windowDays=7` で `calls/tokens/blockedRate/blockReasons/topUsers` を確認する。  
- blocked率急増時は以下の順で切り分ける。  
  1) `opsConfig/llmPolicy.enabled`  
  2) `system_flags.phase0.llmEnabled`  
  3) `LLM_FEATURE_FLAG`  
  4) `LLM_OUTAGE_MODE`  

## 即時ロールバック（優先順）
1) `opsConfig/llmPolicy.enabled=false`  
2) `allowed_intents_pro=[]`  
3) `LLM_OUTAGE_MODE=true`（障害演習/緊急退避）  
4) `LLM_FEATURE_FLAG=false`  

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
1. Secret Manager に `OPENAI_API_KEY` を登録（コードに書かない）。
2. `deploy.yml` の member デプロイが `OPENAI_API_KEY=OPENAI_API_KEY:latest` を runtime secret として参照できる状態にする。
3. GitHub Environment Variables を設定する。
   - `stg`: `LLM_FEATURE_FLAG=true`, `OPENAI_MODEL=gpt-4o-mini`
   - `prod`: `LLM_FEATURE_FLAG=false`, `OPENAI_MODEL=gpt-4o-mini`（stg検証完了まで維持）
4. stg へ deploy 後、以下で config 適用:
   - `POST /api/admin/llm/config/plan`
   - `POST /api/admin/llm/config/set`
5. `GET /api/admin/llm/config/status` で `effectiveEnabled: true` を確認。
6. `audit_logs` で `action='llm_faq_answer_blocked'` が減少していることを確認。

### LLM Config 適用 JSON（固定デフォルト）
`legitimate_interest / consentVerified=false / crossBorder=true` を固定値として使う。

```json
{
  "llmEnabled": true,
  "llmPolicy": {
    "lawfulBasis": "legitimate_interest",
    "consentVerified": false,
    "crossBorder": true
  }
}
```

plan で受け取った `planHash` / `confirmToken` をそのまま `set` に渡す。

### stg先行 -> prod 昇格手順
1. stg で `llmEnabled=true` を適用。
2. `stg-notification-e2e.yml` を `expect_llm_enabled=true` で実行し、`llm_gate` を含む固定順シナリオを PASS させる。
3. stg の trace/audit 証跡（`llm_config.status.view`, `llm_disclaimer_rendered`）を添付してレビュー。
4. prod の `LLM_FEATURE_FLAG=true` へ切替。
5. prod deploy 実施後、prod でも同一 `llmPolicy` を適用し `effectiveEnabled=true` を確認。

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

## Phase653 Addendum（Paid FAQ品質 + Personalization）

### 有料FAQ品質ゲート
- 実装エントリ: `generatePaidFaqReply -> generatePaidAssistantReply -> guardLlmOutput`。
- 品質ゲート:
  - `PAID_FAQ_MIN_TOP1_SCORE`（既定 0）
  - `PAID_FAQ_MIN_CITATION_COUNT`（既定 1）
- 判定:
  - citation不足 -> `blockedReason=citation_missing`
  - 信頼度不足 -> `blockedReason=low_confidence`
- ブロック時は LLM回答を返さず FAQ検索UXへ降格する。

### 監査ログ
- `llm_quality_logs`:
  - `decision`, `blockedReason`, `top1Score`, `top2Score`, `citationCount`, `retryCount`
- `llm_usage_logs`:
  - plan/status/intent/decision/blockedReason/tokenUsed の監査を継続
- `audit_logs`:
  - `action=llm_gate.decision`
  - `payloadSummary.plan/status/intent/decision/blockedReason/tokenUsed/costEstimate/model`

### Personalization文脈
- `resolvePersonalizedLlmContext` で以下をプロンプト文脈に注入する:
  - plan/subscriptionStatus
  - householdType/scenarioKeyMirror
  - journeyStage/departureDate/assignmentDate
  - todoOpenCount/todoOverdueCount/nextTodoDueAt

### 即時停止
- `ENABLE_PAID_FAQ_QUALITY_V2=0`（品質ゲート経路を停止）
- `ENABLE_SNAPSHOT_ONLY_CONTEXT_V1=0`（snapshot strict境界を解除）
- `opsConfig/llmPolicy.allowed_intents_pro=[]`（有料LLM利用停止）

### Admin運用補助
- `GET /api/admin/os/llm-usage/export` で masked CSV を取得できる。  
  `userIdMasked` 以外の識別子を運用用途で再復元しないこと。

## Phase654 Addendum（ToDo依存グラフ連動 / Policy履歴）

### Free / Pro の運用境界
- Free:
  - FAQ検索ベース回答を継続する
  - 依存質問は簡易説明（ロック件数/理由）まで
- Pro:
  - 5ブロック回答契約を維持する
  - `ENABLE_PRO_PREDICTIVE_ACTIONS_V1=1` のとき、依存グラフ補足（ロック理由/次アクション最大3）を末尾追記する

### Task graph 連動条件
- `ENABLE_TASK_GRAPH_V1=1` のときだけ `task_nodes` 参照を行う。  
- 取得失敗時は静かに通常回答へフォールバックする（fail-closed）。  
- `journey_todo_items.status` の意味は変更しない。`locked` は `graphStatus=locked` で扱う。  

### LLM Policy alias / 履歴
- UI入力alias:
  - `max_tokens`
  - `per_user_limit`
  - `rate_limit`
- 保存時は canonical に変換される:
  - `max_output_tokens`
  - `per_user_daily_limit`
  - `global_qps_limit`
- 変更履歴API:

## Phase720 Addendum（Paid Assistant 品質運用）

### 監査キー確認（action=`llm_gate.decision`）
- `payloadSummary.assistantQuality.intentResolved`
- `payloadSummary.assistantQuality.kbTopScore`
- `payloadSummary.assistantQuality.evidenceCoverage`
- `payloadSummary.assistantQuality.blockedStage`
- `payloadSummary.assistantQuality.fallbackReason`

### KPI確認（`GET /api/admin/os/llm-usage/summary?windowDays=7`）
- `summary.assistantQuality.avgKbTopScore`
- `summary.assistantQuality.avgEvidenceCoverage`
- `summary.assistantQuality.acceptedRateByIntent[]`
- `summary.gateAuditBaseline.acceptedRate`
- `summary.gateAuditBaseline.blockedStages[]`

### stg -> prod 段階解放（品質体験改善）
1. stgで `ENABLE_PAID_INTENT_CLASSIFIER_V2=1` を適用する。
2. 24時間観測し、以下を確認する。
   - `citation_missing` と `template_violation` が直近7日基線より悪化していない。
   - `summary.gateAuditBaseline.acceptedRate` が悪化していない。
3. 異常時は `ENABLE_PAID_INTENT_CLASSIFIER_V2=0` で即時停止する。
4. stg安定後に prod へ同一設定を反映する。

### ロールバック
- 即時: `ENABLE_PAID_INTENT_CLASSIFIER_V2=0`
- 段階: 監視継続しつつ `llmConciergeEnabled=false` を併用
- 完全: 変更PRをrevert
  - `GET /api/admin/os/llm-policy/history`
  - `GET /api/admin/llm/policy/history`（同ハンドラ）

### 即時ロールバック（Phase654）
1) `ENABLE_PRO_PREDICTIVE_ACTIONS_V1=0`  
2) `ENABLE_TASK_GRAPH_V1=0`  
3) `opsConfig/llmPolicy.allowed_intents_pro=[]`  
4) `opsConfig/llmPolicy.enabled=false`  

## Phase723 Addendum（Week4 段階解放 / release readiness）

### 目的
- stg観測で品質閾値を満たした場合のみ prod へ反映する。
- 判定は `GET /api/admin/os/llm-usage/summary` の `summary.releaseReadiness` を一次情報とする。

### releaseReadiness の既定閾値
- `minSampleCount=20`
- `minAcceptedRate=0.70`
- `maxCitationMissingRate=0.25`
- `maxTemplateViolationRate=0.20`
- `maxFallbackRate=0.35`
- `minEvidenceCoverage=0.80`

### stg -> prod 手順（固定）
1. stgで有料改善フラグをON（`ENABLE_PAID_INTENT_CLASSIFIER_V2=1` を維持）。  
2. 24時間以上の観測窓で `GET /api/admin/os/llm-usage/summary?windowDays=7` を確認する。  
3. `summary.releaseReadiness.ready=true` かつ `blockedBy=[]` を確認する。  
4. 監査ログ `action=llm_gate.decision` で `assistantQuality.blockedStage/fallbackReason` が急増していないことを確認する。  
5. 条件を満たした場合のみ prod へ同設定を反映する。  

### 自動チェック（Phase717）
- `npm run llm:rollout:check -- --base-url "$BASE_URL" --admin-token "$ADMIN_OS_TOKEN" --require-ready` を実行する。  
- 判定は `summary.releaseReadiness` と `summary.gateAuditBaseline.entryTypes/gatesCoverage` を同時に確認する。  
- fixture で検証する場合は `--config-json` と `--summary-json` を併用する。  

### しきい値の一時上書き（検証用）
- `GET /api/admin/os/llm-usage/summary` に以下クエリを付与して判定比較できる。  
  - `rolloutMinSampleCount`
  - `rolloutMinAcceptedRate`
  - `rolloutMaxCitationMissingRate`
  - `rolloutMaxTemplateViolationRate`
  - `rolloutMaxFallbackRate`
  - `rolloutMinEvidenceCoverage`
- 上書き値は判定比較専用で、恒久運用の既定値を置換しない。  

### 停止条件
- `summary.releaseReadiness.ready=false` の場合は prod 反映を禁止する。  
- `blockedBy` に `accepted_rate` / `citation_missing_rate` / `template_violation_rate` が含まれる場合は stg改善へ戻す。  

### ロールバック
1) `ENABLE_PAID_INTENT_CLASSIFIER_V2=0`（Week2/3改善停止）  
2) 必要時 `llmConciergeEnabled=false`（コンシェルジュ拡張停止）  
3) 重大時 `llmEnabled=false`（LLM全体停止）  

## Phase716 Addendum（LLMコンシェルジュ安全実装）

### 起動/停止フラグ
- `system_flags.phase0.llmConciergeEnabled` を利用する（default: false）。
- `llmConciergeEnabled=true` かつ `llmEnabled=true` のときのみコンシェルジュ拡張を有効化する。
- 既存 `llmEnabled` は従来どおりLLM全体ゲートとして維持する。

### 即時停止手順（コンシェルジュのみ）
1) `POST /api/admin/llm/config/plan` に `llmConciergeEnabled=false` を含める。  
2) 返却 `planHash/confirmToken` で `POST /api/admin/llm/config/set` を実行する。  
3) `GET /api/admin/llm/config/status` で `llmConciergeEnabled=false` を確認する。  

### 外部検索運用
- `WEB_SEARCH_PROVIDER=http_json` + `WEB_SEARCH_ENDPOINT` を設定したときのみ候補取得を試みる。
- 未設定/障害時は fail-closed（候補0件）で継続する。
- free tier は保存済みURLのみ利用し、外部候補を採用しない。

### モード運用（要点）
- Mode A: URLなし
- Mode B: R0/R1のみ（free<=1, paid<=3）
- Mode C: R0/R1/R2（free<=1, paid<=3）
- 全体上限は3件、本文末尾の `(source: domain/path)` 脚注のみ許可

### 監査確認（llm_gate.decision）
- `mode`
- `topic`
- `userTier`
- `citationRanks`
- `urlCount`
- `urls`
- `guardDecisions`
- `blockedReasons`
- `injectionFindings`

### ロールバック
1) `llmConciergeEnabled=false`（コンシェルジュのみ停止）  
2) 必要時 `llmEnabled=false`（LLM全体停止）  
3) 外部検索のみ停止する場合は `WEB_SEARCH_PROVIDER=disabled` にする（fail-closed）。  

## Phase662 Addendum（Policy拡張）

### add-only policy fields
- `forbidden_domains[]`
- `disclaimer_templates{}`
- `output_constraints{ max_next_actions, max_gaps, max_risks, require_evidence, forbid_direct_url }`

### 適用ポイント
- FAQ/Ops/NextAction の disclaimer は `disclaimer_templates` を優先する。
- Paid assistant は `output_constraints` に従って出力上限を制約する。
- 禁止領域は `forbidden_domains` で判定し、`blockedReason=forbidden_domain` で安全降格する。

### 運用確認
1) `GET /api/admin/llm/policy/status` で設定反映を確認。  
2) `POST /api/admin/llm/policy/plan` -> `set` の2段階で適用。  
3) `GET /api/admin/os/llm-policy/history` で変更証跡を確認。  

## Phase664 Addendum（Plan Unlock cap連動）

### maxNextActions の実効上限
- Paid assistant の next actions 上限は次の小さい方を採用する。  
  - `opsConfig/llmPolicy.output_constraints.max_next_actions`
  - `opsConfig/journeyGraphCatalog.planUnlocks.<free|pro>.maxNextActions`
- `plan=free` は `planUnlocks.free.maxNextActions`、`plan=pro` は `planUnlocks.pro.maxNextActions` を参照する。  
- 既定運用は Free=1, Pro=3 を推奨し、運用変更は `journey-graph plan -> set` で実施する。  

### 監査確認
- `audit_logs.action=llm_gate.decision` の payload で `decision/blockedReason` を確認する。  
- Next actions が空のときは拒否UXへフォールバックし、回答を強行しない。  

### 即時停止
1) `ENABLE_PRO_PREDICTIVE_ACTIONS_V1=0`（有料補助導線停止）  
2) `opsConfig/llmPolicy.output_constraints.max_next_actions=0`（出力上限を強制停止）  
3) `opsConfig/llmPolicy.enabled=false`（LLM全停止）  

## Phase665 Addendum（refusal strategy / policy_version_id）

### add-only policy fields
- `opsConfig/llmPolicy.refusal_strategy`
  - `mode`: `suggest_and_consult|faq_only`
  - `show_blocked_reason`: boolean
  - `fallback`: `free_retrieval`
- `opsConfig/llmPolicy.policy_version_id`

### 適用ポイント
- 拒否時フォールバックは `free_retrieval` を維持する。  
- 監査 `llm_gate.decision` へ `policyVersionId` と `refusalMode` を追記する。  

## Phase724 Addendum（Next Level P2+P3）

### Layer kill switch（system_flags/phase0）
- `llmWebSearchEnabled`（default true）
- `llmStyleEngineEnabled`（default true）
- `llmBanditEnabled`（default false）
- 既存 `llmEnabled` / `llmConciergeEnabled` は従来契約を維持する。

### 推奨段階解放（stg -> prod）
1) stgで `llmEnabled=true` + `llmConciergeEnabled=true` + `llmBanditEnabled=false`。  
2) 監査 `llm_gate.decision` で以下を確認:  
   - `evidenceOutcome`  
   - `postRenderLint`  
   - `blockedReasons`  
   - `chosenAction.selectionSource`  
3) 問題なしで `llmBanditEnabled=true`。  
4) `releaseReadiness.ready=true` 維持を確認して prod 段階反映。  

### Internal Reward Job
- endpoint: `POST /internal/jobs/llm-action-reward-finalize`
- token: `LLM_ACTION_JOB_TOKEN`
- default: `rewardWindowHours=48`
- dry run 例:
```json
{
  "dryRun": true,
  "limit": 100,
  "rewardWindowHours": 48
}
```

### 停止手順（部分停止優先）
1) `llmBanditEnabled=false`（最小影響）  
2) 必要に応じて `llmStyleEngineEnabled=false`  
3) 必要に応じて `llmWebSearchEnabled=false`  
4) 緊急時は `llmConciergeEnabled=false`  

## Phase725 Addendum（P4 readiness: contextual/counterfactual observability）

### 監査確認項目（追加）
`audit_logs(action=llm_gate.decision)` で次を確認する。  
- `contextualFeatures.featureVersion` が `bandit_ctx_v1`  
- `contextualFeatures.mode/topic/tier` が `mode/topic/userTier` と矛盾しない  
- `counterfactualTopArms` が空でない（bandit/score選択時）  
- `counterfactualSelectedRank` が 1以上または null（欠損時）  

### 期待挙動
- 追加キーは監査専用。返信本文の安全契約は変えない。  
- URL/注入/Mode制約は従来どおり guard が優先する。  

### 異常時
- `contextualFeatures` 欠損のみ: 継続運用可（best effort）。  
- `counterfactualTopArms` が常に空: `composeConciergeReply` と `actionSelector` の連携を確認。  
- 影響縮小は `llmBanditEnabled=false` を先に適用。  

## Phase726 Addendum（contextual bandit runtime）

### 監査確認項目（追加）
`audit_logs(action=llm_gate.decision)` で次を確認する。  
- `contextSignature` が `ctxsig_v1_` で始まる  
- `contextualBanditEnabled=true` のとき `chosenAction.selectionSource` が `bandit_contextual_*` または `bandit_*`  

### 学習状態確認
`llm_contextual_bandit_state` で以下を確認する。  
- `segmentKey/contextSignature/armId` 単位で `pulls` が増加している  
- `avgReward` が極端値に偏った場合は `llmBanditEnabled=false` で即時停止可能  

## Phase727 Addendum（counterfactual evaluation）

### 監査確認項目（追加）
`audit_logs(action=llm_gate.decision)` で次を確認する。  
- `counterfactualEval.version` が `v1`  
- `counterfactualEval.eligible=true` のレコードで `selectedArmId/bestArmId` が存在する  
- `counterfactualEval.opportunityDetected=true` が特定segmentに偏っていない  

### reward finalize バッチ確認
`POST /internal/jobs/llm-action-reward-finalize` の応答で次を確認する。  
- `counterfactualEvaluated` が 0 のまま固定されていない  
- `counterfactualOpportunityDetected` が急増した場合は `llmBanditEnabled=false` で影響縮小する  

### 調査優先順
1) `counterfactualOpportunityDetected` が高い segment を抽出  
2) 同segmentの `selectionSource` と `scoreBreakdown` を確認  
3) `wrong_evidence` が同時増加する場合は bandit停止を優先  
