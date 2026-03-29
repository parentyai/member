# 07 Architecture Options

## Option A: Link Injection Only

- summary:
  - attach links to existing answers without deeper flow change
- advantage:
  - smallest surface change
  - fast to rollback
- drawback:
  - does not solve task invisibility
  - does not unify route voice
  - risks link spam without relevance contract
- safety impact:
  - low
- renderer impact:
  - low
- Task OS impact:
  - none
- rich menu impact:
  - none
- observability impact:
  - weak
- rollout ease:
  - high
- rollback ease:
  - high
- recommendation:
  - reject as primary plan

## Option B: Task OS First

- summary:
  - promote task / todo / journey views first and let conversation follow later
- advantage:
  - strong operational spine
  - leverages existing journey and task assets
- drawback:
  - assistant lane remains under-informative in the meantime
  - user experience may feel like command UI, not concierge
- safety impact:
  - medium
- renderer impact:
  - medium
- Task OS impact:
  - high
- rich menu impact:
  - high
- observability impact:
  - good
- rollout ease:
  - medium
- rollback ease:
  - medium
- recommendation:
  - insufficient alone

## Option C: Resolution Concierge Layer

- summary:
  - keep route owners and leaf families intact
  - add a downstream layer between answer selection and rendering that assembles:
    - official links
    - next best action
    - task visibility
    - handoff hints
- advantage:
  - directly targets the observed composition problem
  - add-only relative to route owners
  - preserves safety and canonical grouping boundaries
- drawback:
  - requires a new response contract and adapter discipline
  - needs careful parity checks per lane
- safety impact:
  - medium, but manageable
- renderer impact:
  - low to medium
- Task OS impact:
  - medium
- rich menu impact:
  - medium
- observability impact:
  - strong
- rollout ease:
  - medium
- rollback ease:
  - high with feature flags
- recommendation:
  - recommended

## Option D: Shadow Improvement Loop First

- summary:
  - build shadow eval and replay loop before changing live response composition
- advantage:
  - strong diagnostics
  - safer optimization path
- drawback:
  - does not itself raise user-facing information density
  - still depends on defining what “better” means
- safety impact:
  - low in shadow mode
- renderer impact:
  - none initially
- Task OS impact:
  - none initially
- rich menu impact:
  - none initially
- observability impact:
  - very strong
- rollout ease:
  - medium
- rollback ease:
  - high
- recommendation:
  - required companion track, not primary first move

## Comparative conclusion

- best primary architecture: `Option C`
- required companion: `Option D`
- why not reset:
  - observed problem is mainly composition, visibility, and route integration
  - repo already has link registry, task state, rich menu assignment, journey commands, and integrated spec scaffolding
  - reset would discard reusable deterministic assets and raise rollback risk

