# LLM_PHASE_PLAN

## Overview
LLM 統合は Phase1-5 で段階導入し、advisory-only と fail-closed を維持する。

## Dependencies
- Phase1 -> Phase2/3/4 -> Phase5

## Phase1 (Guardrails)
- Close: allow-list / schema validation / feature flag disabled-by-default がテストで固定。

## Phase2 (Ops Explanation)
- Close: OpsExplanation.v1 が API で返り、fallback と audit が動作。

## Phase3 (Next Action Candidates)
- Close: 抽象 action のみ返却、invalid schema/citation で fallback。

## Phase4 (FAQ Answer)
- Close: link_registry sourceId のみを引用、WARN link はブロック。

## Phase5 (Operations)
- Close: Runbook / Phase plan / Test plan が揃い、停止・監査・復旧が手順化されている。

## Phase208 (LLM × DB Integration Hardening)
- Close:
  - FAQ が KB 限定（`faq_articles`）で動作
  - citations 0 件は 422 BLOCK
  - 二重ゲート（`llmEnabled` + `LLM_FEATURE_FLAG`）がテスト固定
  - `/api/phaseLLM4/faq/answer` は互換維持（deprecated）
  - 監査ログが traceId で成功/BLOCK両方追跡可能

## Phase235 (Guide-only Unlock for User-facing Safety)
- Close:
  - FAQ guideMode が `faq_navigation|question_refine|checklist_guidance` のみ許可
  - personalization は `locale|servicePhase` のみ許可
  - `guide_only_mode_blocked` / `personalization_not_allowed` を 422 BLOCK で返す
  - 監査 payloadSummary に `guideMode` / `personalizationKeys` が残る

## Phase243-249 (Safety hardening and guide-only expansion)
- Phase243:
  - KB schema hardening (`version` add-only + `versionSemver` compatibility)
  - invalid schema rows are excluded from search (fail-closed)
- Phase244:
  - confidence contract visibility (`kbMeta` in success/blocked)
- Phase245:
  - disclaimer render audit extended with `surface`
- Phase246:
  - BLOCK UX contract fixed (`fallbackActions` + `suggestedFaqs<=3`)
- Phase247:
  - Ops template ordering fixed
  - NextAction UI displays lowercase while internal enum remains uppercase
- Phase248:
  - shared blockedReason taxonomy + `regulatoryProfile` in audit payload
- Phase249:
  - guide-only policy reaffirmed for user-facing rollout (`faq_navigation|question_refine|checklist_guidance`)
