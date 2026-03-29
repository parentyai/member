# 19 Risk Register

| Risk class | Trigger | Detection | Impact | Mitigation | Rollback |
| --- | --- | --- | --- | --- | --- |
| `safety_erosion` | answer-first logic bypasses readiness semantics | safety regression tests, must-pass fixtures | unsafe advice | concierge layer cannot override safety decision | disable concierge flag |
| `link_spam_without_relevance` | links attached by default | link relevance assertions, human review | noisy answers | require `why_relevant` and per-lane rules | disable link-first flag |
| `official_link_freshness_drift` | stale link shown as action path | freshness checks, audit logs | bad operational guidance | explicit freshness field + fallback note | suppress link emission |
| `route_invisibility_break` | unified layer hides lane-specific protections | route persona continuity tests | contract drift | preserve canonical owners and lane tags | per-lane rollout off |
| `task_overload` | too many asks in one turn | human review, contract max-one-question rule | user burden rises | top-1 action only | task bridge off |
| `rich_menu_over_complexity` | menu binding becomes routing maze | menu utilization and operator review | confusion | keep 5 persistent entry families only | rich-menu bridge off |
| `renderer_mismatch` | richer contract does not fit transport limits | renderer snapshot + overflow tests | broken payloads | renderer stays deterministic | fall back to current semantic renderer |
| `hidden_route_regressions` | one lane regresses while another improves | before/after lane comparison | silent quality loss | lane-specific flags and reports | roll back affected lane only |
| `false_naturalness_without_task_progress` | copy sounds better but no task movement | task progression KPI | cosmetic win only | task delta is required field | reject rollout |
| `self_improvement_loop_runaway` | shadow loop exceeds budget or scope | action budget, cooldown, allowlist audit | uncontrolled experimentation | stop switch + allowlist-only | turn off shadow loop |
| `live_user_impact_without_canary` | shadow path leaks into live | audience checks, rollout audit | production exposure | canary-only gate and human approval | disable canary flag |
| `rollout_scope_creep` | adjacent operator / notification lanes get mixed in | changed-file review and lane gate | system complexity spike | keep main concierge lane isolated | revert out-of-scope change set |

