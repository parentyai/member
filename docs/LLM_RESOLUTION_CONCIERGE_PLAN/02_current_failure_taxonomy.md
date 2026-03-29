# 02 Current Failure Taxonomy

## Scope note

This taxonomy is repo-fact based. It diagnoses current structure, not model IQ.  
Workbook-dependent UX diagnosis is provisional because the workbook was not observed.

## Failure classes

| Failure class | Observed lane / file / artifact | User-visible symptom | Concierge break |
| --- | --- | --- | --- |
| `under_informative_answer` | `src/usecases/assistant/generatePaidDomainConciergeReply.js`, `src/usecases/assistant/generatePaidCasualReply.js`, `src/domain/llm/orchestrator/finalizeCandidate.js` | reply is short but not operationally dense | user gets a hint, not a resolution packet |
| `missing_official_link` | `src/usecases/assistant/concierge/composeConciergeReply.js` has URL selection, but paid finalizer / casual / domain lanes do not make links first-class; `src/repos/firestore/linkRegistryRepo.js` exists but is not carried as response contract | answer may mention action without official destination | evidence-first concierge promise is not visible |
| `answer_without_next_action` | `generatePaidDomainConciergeReply.js`, `generatePaidCasualReply.js`, webhook fallbacks | answer exists but next concrete task is optional or shallow | conversation does not move a task state |
| `no_task_externalization` | task state is rich in journey lane (`handleJourneyLineCommand.js`, `taskDetailSectionReply.js`, `renderTaskFlexMessage.js`) but assistant lane output stays mostly plain text | user cannot see task/due/blocker from normal assistant turn | Task OS remains hidden unless user already knows command syntax |
| `todo_invisibility` | `handleJourneyLineCommand.js` exposes `TODO一覧`, `今日の3つ`, `TODO詳細`, but top-level assistant turns do not bridge to them | rich task state exists but is discoverable mainly via command knowledge | concierge cannot proactively externalize work |
| `over_clarification` | `applyAnswerReadinessDecision.js`, `runPaidConversationOrchestrator.js`, top-level webhook readiness paths | multiple routes converge on “tell me procedure and deadline first” patterns | answer-first rule is structurally weak |
| `fallback_overuse` | `minSafeApplyRegistry.js`, `lineChannelRenderer.js`, `fallbackRenderer.js`, `webhookLine.js#guardPaidMainReplyText` | generic safe text appears before tailored next steps | safety scaffolding dominates usefulness |
| `disclaimer_frontloading` | readiness hedge/refuse/clarify leaves, top-level fallback wording | uncertainty language arrives before operational help | user hears caution before resolution |
| `route_style_fragmentation` | `composeConciergeReply.js`, `generatePaidDomainConciergeReply.js`, `generatePaidCasualReply.js`, `finalizeCandidate.js`, journey text handlers | same product sounds like different systems by lane | “same concierge” illusion breaks |
| `safety_voice_dominance` | `runAnswerReadinessGateV2`, `applyAnswerReadinessDecision.js`, `resolveIntentRiskTier`, top-level webhook gating | cautionary lane wins over concrete action lane | safety posture is visible as the product voice itself |
| `multi_purpose_message` | `finalizeCandidate.js`, `generatePaidDomainConciergeReply.js`, task list strings in `handleJourneyLineCommand.js` | one text often tries to summarize, warn, ask, and guide at once | one-turn-one-purpose rule is not enforced |
| `renderer_flatness` | `lineChannelRenderer.js`, `semanticLineMessage.js`, `lineInteractionPolicy.js` | output surface is chosen mainly by text length / quick reply presence | surface fit is weakly tied to task progression or official-link needs |
| `control_speak` | journey command strings and fallback texts in `handleJourneyLineCommand.js`, `taskDetailSectionReply.js`, `sendWelcomeMessage.js` | product sometimes sounds like command parser / admin system | conversational concierge tone is interrupted by control UI language |
| `helpfulness_without_resolution` | integrated spec has `Task Planner` and `tasks`, but current lane implementations often stop at guidance text | advice is useful yet does not update visible task/next action state | helpfulness exists without measurable progression |
| `rich_menu_detached_from_conversation` | `applyPersonalizedRichMenu.js` and `applyRichMenuAssignment.js` manage persistent navigation, but no assistant contract binds reply intent to menu entry | menu exists as assignment system, not as per-turn task progression bridge | persistent nav is not part of the response logic |

## Lane-specific diagnosis

### Free retrieval lane

- evidence:
  - `src/routes/webhookLine.js#replyWithFreeRetrieval`
  - canonical units for free retrieval and style shells
- break:
  - retrieval may answer, but task / due / blocker / menu handoff are not first-class output requirements.

### Paid readiness / finalizer lane

- evidence:
  - `src/domain/llm/quality/applyAnswerReadinessDecision.js`
  - `src/domain/llm/orchestrator/finalizeCandidate.js`
- break:
  - readiness text is robust, but resolution package is not standardized beyond reply text.

### Top-level webhook lane

- evidence:
  - `src/routes/webhookLine.js`
  - `leaf_webhook_*` safe literals
- break:
  - command ack, fallback, retrieval fallback, paid assistant, and journey command text coexist at the same entrypoint without one concierge-specific resolution contract.

### Journey / Task OS lane

- evidence:
  - `src/usecases/journey/handleJourneyLineCommand.js`
  - `src/usecases/journey/handleJourneyPostback.js`
  - `src/usecases/tasks/renderTaskFlexMessage.js`
- break:
  - task visibility is relatively rich, but isolated behind command/postback surfaces.

### Renderer lane

- evidence:
  - `src/v1/line_surface_policy/lineInteractionPolicy.js`
  - `src/v1/line_renderer/semanticLineMessage.js`
  - `src/v1/line_renderer/lineChannelRenderer.js`
- break:
  - surface adaptation is mostly transport-safe, not resolution-first.

## Root-cause summary

The observed 5/100-style failure is best explained by composition and lane separation:

1. evidence, task state, link registry, and rich menu all exist
2. they are not assembled into one resolution contract before render
3. safety and fallback copy have stronger runtime presence than task and link visibility

That supports the initial hypothesis that routing / safety / template / renderer / fallback / clarify / surface composition is the primary issue, not model swap by default.

