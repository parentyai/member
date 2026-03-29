# 06 Principle Matrix

| Principle | Decision | Current conflict | Phase1 scope | Notes |
| --- | --- | --- | --- | --- |
| `P1 Resolution over chit-chat` | `accept` | casual and fallback lanes can end in “tell me more” without visible task progress | yes | supported by task planner and journey/task assets already present |
| `P2 Link-first, not link-last` | `accept_with_constraints` | link registry exists, but response contract does not require links and renderer/handoff policy is not integrated | yes | only relevant, authoritative links; no rich-menu direct URL dumping |
| `P3 Task-first, not answer-only` | `accept` | task state is rich but command-gated | yes | assistant lane should consume Task OS adapter instead of duplicating Task OS |
| `P4 Answer-first, ask-second` | `accept_with_constraints` | readiness / clarify leaves are strong and can dominate answer-first behavior | yes | ask at most one question after giving a provisional action path unless safety stop forbids it |
| `P5 Specificity escalation` | `accept` | some lanes repeat generic clarify / fallback text | yes | conversation contract should record `specificity_level` and require monotonicity where possible |
| `P6 Rich menu is persistent navigation, not decoration` | `accept` | rich menu assignment exists but is detached from reply composition | yes | workbook details missing, so menu IA is provisional until workbook is supplied |
| `P7 Surface-fit practical delivery` | `accept` | current surface planner relies more on text length / quick reply than on task fit | yes | renderer remains deterministic; upstream contract gets richer |
| `P8 Fact-preserving shaping` | `accept` | some shell families and fallback copy tempt over-shaping | yes | no new facts; only order, density, link, task, and handoff visibility |
| `P9 Official-first concierge` | `accept_with_constraints` | official links are not guaranteed for many lanes; freshness / authority display is incomplete | yes | no link spam; authority band and freshness status become explicit contract fields |
| `P10 Shadow improvement before live optimization` | `accept_with_constraints` | this repo does not contain an observed LINE desktop harness implementation | phase2 | design only in phase1; actual desktop loop must remain shadow / allowlist and may depend on external harness integration |

## Additional constraints from repo facts

1. shell-only and human/policy-freeze leaves stay out of phase1 live copy changes.
2. route families in canonical grouping must remain traceable; no “unified prompt” shortcut.
3. notification / operator / admin copy remains separate from concierge lane even if wording converges.

