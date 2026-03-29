# 08 Recommended Architecture

## Adopted architecture

Adopt **Resolution Concierge Layer + Link Registry contract + Task OS adapter + Rich Menu bridge + Shadow self-improvement loop**.

## Why reset is not the default answer

Reset is not justified by the observed repo state because:

1. route owners and safety gates already exist
2. link registry and task state already exist
3. journey and rich menu persistence already exist
4. the main observed failure is weak assembly into one resolution surface

This is a composition problem first, not a “start over” problem first.

## What changes

### Concierge layer responsibility

- take route-selected answer material as input
- add official links when relevant and allowed
- externalize task / due / blocker state
- compute next best action
- choose whether to stay in chat or hand off to rich menu / LIFF / MINI App
- preserve route owner boundaries

### Link registry responsibility

- normalize user-facing link payloads
- rank authority and freshness
- choose open surface
- explain why the link is relevant

### Task OS adapter responsibility

- read existing task / journey state
- project it into assistant response contract without mutating task semantics
- expose only the top actionable fragment needed for the current turn

### Rich menu bridge responsibility

- convert `next_best_action` into persistent navigation binding
- map reply intent to existing menu entry families
- keep actual menu assignment separate from answer generation

### Shadow self-improvement loop responsibility

- score response quality in shadow / replay / canary
- propose improvements
- never auto-ship changes to live users in phase1

## What does not change

- canonical grouping primary/mirror ownership
- existing route entrypoints
- existing safety gates
- existing journey/task storage semantics
- existing renderer transport safety limits

## What the concierge layer must never do

1. invent facts not backed by route evidence
2. overwrite safety decisions
3. merge operator/admin copy into user concierge copy
4. bypass task state machine semantics
5. emit direct rich-menu URLs that violate `URI_DIRECT_URL_REJECTED`
6. turn shell-only leaves into live final wording by accident

## Feature-flag strategy

- `ENABLE_RESOLUTION_CONCIERGE_LAYER_V1`
- `ENABLE_LINK_FIRST_RESPONSE_V1`
- `ENABLE_TASK_OS_RESPONSE_BRIDGE_V1`
- `ENABLE_RICH_MENU_CONVERSATION_BRIDGE_V1`
- `ENABLE_CONCIERGE_SHADOW_EVAL_V1`

All are add-only and individually reversible.

## Fail-safe / fallback / observability

- fail-safe:
  - fall back to current lane behavior if concierge layer cannot assemble contract
- fallback:
  - no link => no link block, but still next action and task note when safe
- observability additions:
  - `resolution_state`
  - `specificity_level`
  - `next_best_action_present`
  - `official_link_count`
  - `task_visibility_present`
  - `menu_binding_present`
  - `handoff_surface`

