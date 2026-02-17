# LLM_DESIGN_DECISIONS

This file isolates design decisions that are not directly backed by existing repo SSOT.

## Decision: LLM feature flag name
- Decision: Use env key `LLM_FEATURE_FLAG` to disable LLM features.
- Reason: Separate from killSwitch (send stop) and make LLM control explicit.
- Alternatives: Reuse OPS_ASSIST_LLM_ENABLED only.
- Revisit: If SSOT defines a different flag name or location.

## Decision: Direct URL forbidden for FAQ outputs
- Decision: Block direct URLs in LLM outputs, return link_registry sourceId only.
- Reason: Consistency with link_registry health guard and click tracking.
- Alternatives: Allow URLs with allow-list of domains.
- Revisit: When FAQ source becomes an internal dataset with safe redirect layer.

## Decision: Abstract action categories
- Decision: LLM candidate actions use abstract categories only.
- Reason: Avoid coupling to Runbook commands; deterministic layer must provide execution steps.
- Alternatives: Use full runbook action names.
- Revisit: Only if SSOT defines explicit LLM action contract.

## Decision: Dual gate for effective LLM enablement
- Decision: effective enabled = `system_flags.phase0.llmEnabled && LLM_FEATURE_FLAG`.
- Reason: DB運用停止と環境停止の二重ブレーキで fail-closed を強化する。
- Alternatives: DB only / ENV only.
- Revisit: if SSOT defines single-source governance.

## Decision: KB retrieval mode (phase208 initial)
- Decision: FAQ retrieval uses rule-based search over `keywords/synonyms/tags` only.
- Reason: no new infra dependency; deterministic and auditable ranking.
- Alternatives: embeddings.
- Revisit: if recall is insufficient in ops evidence.
