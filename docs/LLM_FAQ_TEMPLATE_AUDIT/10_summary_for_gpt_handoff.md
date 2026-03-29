# 10 Summary for GPT Handoff

## Counting basis

- normalized template families: **32**
- exact text blocks captured: **319**

## Required analysis answers

1. Current repo normalized user-facing template families: **32**
2. Runtime reachable families: **15**
3. Family counts by requested type (normalized-family basis): FAQ=10, fallback=9, warning=4, disclaimer=2, CTA=3, button=2, quick reply=0
4. Hardcoded vs catalog/seed/policy-backed ratio: **30:2** (almost all preset user-facing templates are hardcoded in JS; no runtime JSON/YAML seed catalog was observed in this snapshot)
5. Templates with explicit selection path captured: **32**
6. Templates with unclear path: **0**
7. Dead/test-only families in main inventory: **2** (`search_kb_replytext_templates`, `paid_assistant_legacy_structured_format`); exclusions outside main inventory add internal prompts and eval fixtures
8. Major duplication zones: disclaimer/clarify safety layers; school direct answers; banking next-step direct answers; generic fallback phrasing; strategyReason branches collapsing into same domain concierge copy
9. Untested or partially asserted families (high priority): policy override disclaimer resolution, generic disclaimer fallback branch, direct `searchFaqFromKb` ranked replyText asserts, slice-specific runtime knowledge fallback lines, Choice/Debug/Story style exact strings, housing/ssn/banking free contextual direct answers
10. Recommended GPT handoff units: (a) disclaimers and FAQ blocked CTA labels, (b) free retrieval empty/ranked families, (c) style engine family, (d) paid casual family, (e) paid domain concierge family, (f) safety/clarify/refuse family, (g) webhook top-level assistant fallbacks, (h) journey command replies, (i) task flex/button labels, (j) notification/welcome/adjacent runtime families

## Baseline conclusions

- The preset user-facing template estate is highly **hardcoded** and route-distributed.
- Free retrieval intentionally retains FAQ/CityPack/citation vocabulary that paid routes later strip out.
- Safety copy exists in multiple layers for fail-safe reasons; some duplication is intentional redundancy, some is drift-prone overlap.
- Quick reply fixed preset labels were **not observed** as a standalone runtime-connected preset family in this snapshot; observed quick reply surfaces appear to be upstream dynamic payloads.

## Counterexample duty summary

- A string was not promoted into live runtime truth unless a source -> route/selector -> surface chain was observed.
- Same-copy/different-route cases were kept split where selection conditions differed.
- Docs/test/internal prompts were kept out of the live template inventory.