# 17 Eval And KPI Plan

## Required metrics

| Metric | Meaning |
| --- | --- |
| `answer_first_rate` | answer appears before clarify |
| `specificity_gain_per_turn` | later turn is more concrete than earlier turn |
| `official_link_attachment_rate` | responses with relevant official or primary path |
| `next_action_presence_rate` | responses with explicit next best action |
| `task_visibility_rate` | responses that expose task state or task delta |
| `blocker_visibility_rate` | responses that reveal why progress is blocked |
| `due_visibility_rate` | responses that expose due signal when relevant |
| `rich_menu_entry_utilization_rate` | turns that successfully bind to persistent nav |
| `todo_completion_rate` | downstream task completion proxy |
| `unnecessary_clarify_rate` | avoidable clarification turns |
| `disclaimer_frontload_rate` | disclaimer appears before useful guidance |
| `fallback_rate` | generic fallback share |
| `human_naturalness_review_score` | human judgment of “feels natural and useful” |
| `concierge_helpfulness_score` | human judgment of resolution usefulness |
| `safety_regression_rate` | unsafe regressions detected |

## Evaluation design

### offline golden set

- use canonical grouping families and top failure taxonomy classes
- include free retrieval, paid, journey, fallback, welcome, citypack feedback boundaries

### journey-phase scenario set

- derive from integrated spec lifecycle stages
- workbook-derived scenarios remain provisional until workbook is supplied

### before / after lane comparison

- compare current route outputs against concierge-layer outputs
- keep route family separation in reports

### shadow desktop replay

- use only allowlist / replay / canary
- compare transcript + contract + score

### canary gate

- enable only after offline and shadow replay pass
- limited audience and budget

### regression thresholds

- `answer_first_rate` must not drop
- `official_link_attachment_rate` must rise in mandated lanes
- `task_visibility_rate` must rise
- `safety_regression_rate` must stay at zero-tolerance threshold

### abort thresholds

- new safety regression
- persona divergence spike
- clarify inflation
- official-link relevance collapse

## Suggested test artifacts

1. response contract snapshot
2. no-new-facts assertion
3. link relevance assertion
4. task progression assertion
5. route persona continuity assertion
6. surface-fit assertion

