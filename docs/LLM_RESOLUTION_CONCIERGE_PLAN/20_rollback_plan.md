# 20 Rollback Plan

## Immediate stop

Turn off the additive concierge flags independently:

1. `ENABLE_RESOLUTION_CONCIERGE_LAYER_V1=0`
2. `ENABLE_LINK_FIRST_RESPONSE_V1=0`
3. `ENABLE_TASK_OS_RESPONSE_BRIDGE_V1=0`
4. `ENABLE_RICH_MENU_CONVERSATION_BRIDGE_V1=0`
5. `ENABLE_CONCIERGE_SHADOW_EVAL_V1=0`

## Staged rollback

1. disable the affected lane flag
2. keep existing route owners and safety gates active
3. retain audit and evidence outputs for diagnosis
4. revert only the newest additive contract / adapter layer if needed

## Full rollback

1. revert the PR that introduced the concierge layer scaffold
2. revert subsequent lane integration PRs in reverse order:
   - PR6
   - PR5
   - PR4
   - PR3
   - PR2
   - PR1
3. leave canonical grouping, min-safe registry, and existing journey/task behavior intact

## Data impact

- planned path should be add-only
- do not alter existing task or journey storage semantics
- response-layer telemetry fields may be left in place after rollback if backward compatible

## Shadow loop rollback

- kill switch off
- stop canary audience
- preserve transcript, score, diff, and decision logs
- do not auto-delete evidence needed for audit

