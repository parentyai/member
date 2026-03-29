# 13 Conversation To Resolution Flow

## Core turn shape

Every practical concierge turn should follow this order unless a safety stop short-circuits it:

1. situation summary
2. answer / provisional guidance
3. next best action
4. official link(s)
5. task update / due / blocker
6. optional single clarifying question
7. handoff / menu / LIFF / MINI App suggestion if needed

## Constraints

- one turn has one primary objective
- the answer still carries the minimum operational payload needed for progress
- clarify count is `0 or 1`
- disclaimers are post-positioned where possible
- a reply that does not move task state or unblock the next move is considered a failure
- route differences must not leak as visible persona differences

## Resolution state progression

| resolution_state | meaning |
| --- | --- |
| `informing` | first useful answer exists but no concrete action yet |
| `narrowing` | answer is present and one blocker or missing fact is being reduced |
| `actionable` | next best action and required docs are explicit |
| `handoff_ready` | user should continue in LIFF / MINI App / menu entry |
| `escalate_human` | human handoff is safer than continuing in chat |

## Specificity rule

Specificity should normally increase turn to turn by one of:

- narrower task scope
- more precise docs requirement
- clearer deadline
- more relevant official link
- more explicit blocker

## Route unification rule

Current lanes remain separate internally, but user-facing response shape should converge on the same resolution contract across:

- free retrieval
- paid finalizer
- paid casual
- top-level webhook fallback / clarify / refuse / ack
- journey-assisted responses

## Surface-fit rules

| condition | preferred surface |
| --- | --- |
| one quick user choice | quick reply |
| checklist / comparison / citations | flex |
| structured sensitive input | LIFF |
| stateful continuation | MINI App |
| persistent navigation hint | rich menu binding |

## Phase1 non-goals

- do not make every turn a flex card
- do not overload every reply with all available task data
- do not ask more than one new question just because more data would be nice

