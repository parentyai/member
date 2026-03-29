# 03 Concierge Target State

The target bot is not a long-form explainer. It is a link-first practical concierge.

## Turn contract

1. `answer_summary`
2. `why_it_matters`
3. `next_best_action`
4. `official_links[]` only when useful
5. `task_hint` only when taskable
6. `menu_hint` only when useful
7. `follow_up_question` at most one

## Phase1 output rule

- answer first
- ask second
- prefer one actionable next step over multi-purpose paragraphs
- keep links in registry-backed contract form
- do not leak route differences in user-facing phrasing
