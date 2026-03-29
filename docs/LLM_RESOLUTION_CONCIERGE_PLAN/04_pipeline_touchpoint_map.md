# 04 Pipeline Touchpoint Map

## Resolution-quality framing

Current pipeline components already exist, but resolution-critical data is split across lanes.

## Current flow by layer

| Layer | Current observed touchpoint | Resolution gap | Candidate insertion point |
| --- | --- | --- | --- |
| inbound user message | `src/routes/webhookLine.js` | message enters one webhook but lane ownership diverges early | preserve webhook edge; do not merge routes |
| intent / route | `routeConversation`, `normalizeConversationIntent`, journey parsers | route selection is strong, user-facing output consistency is weak | add concierge layer after route-specific content candidate selection |
| missing fact prioritization | integrated spec U-04, paid orchestrator, readiness gates | clarification is visible, but answer-first packing is not enforced | insert answer-first / ask-second resolver before final render |
| task planner | integrated spec U-13, journey commands, task repos | task state exists mainly in journey lane | add Task OS adapter that projects task state into assistant response contract |
| safety / readiness / finalize | `runAnswerReadinessGateV2`, `applyAnswerReadinessDecision`, `finalizeCandidate` | safe text can dominate useful action | move safety outputs behind concierge response structure |
| leaf / template selection | FAQ leaf artifacts, style shells, direct answers, min safe apply registry | shells and lane owners are fragmented | keep owner groups; compose downstream |
| link attachment point | `composeConciergeReply.js`, `linkRegistryRepo.js`, `selectUrls`, task link refs | links are not required fields in every practical answer | add Link Registry / Link Assembler layer before renderer |
| task-to-surface translation | `lineInteractionPolicy.js`, `semanticLineMessage.js`, `renderTaskFlexMessage.js` | surface selection uses text length and quick replies more than task fit | extend with resolution surface planner |
| rich menu / LIFF / MINI App handoff | `applyPersonalizedRichMenu.js`, integrated spec surface rules | persistent nav exists but is not synchronized with per-turn next action | add Rich Menu bridge and handoff hints in response contract |
| renderer | `semanticLineMessage.js`, `lineChannelRenderer.js` | rendering is transport-safe, not concierge-rich | keep renderer deterministic, feed richer semantic contract |
| final LINE payload | text / flex / template / push | payload lacks structured task + link + due semantics in many lanes | use response contract -> renderer translation |
| memory / task writeback | integrated spec memory fabric, journey repos, audit logs | writeback and user-visible task update are not unified | add explicit task delta section in response contract |

## Lane-specific insertion candidates

### Free retrieval

- current owner:
  - `replyWithFreeRetrieval`
  - free retrieval / free contextual follow-up groups
- insert:
  - concierge layer after retrieval ranking and before final text shaping

### Paid readiness / finalizer

- current owner:
  - `runPaidConversationOrchestrator`
  - `applyAnswerReadinessDecision`
  - `finalizeCandidate`
- insert:
  - resolution concierge layer between selected answer candidate and finalizer
  - link and task packer before readiness text is applied

### Webhook top-level fallback / clarify / refuse / ack

- current owner:
  - `src/routes/webhookLine.js`
  - `leaf_webhook_*`
- insert:
  - no new route
  - wrap existing fallback families in response contract so they still carry next action / menu hint if safe

### Welcome

- current owner:
  - `src/usecases/notifications/sendWelcomeMessage.js`
- insert:
  - welcome should become concierge entry hint into Task OS / Rich Menu, not only “official contact” notice

### CityPack feedback

- current owner:
  - `src/domain/cityPackFeedbackMessages.js`
- insert:
  - keep operational command lane separate
  - do not mix operator feedback copy into main concierge lane

### Line renderer defaults

- current owner:
  - `src/v1/line_renderer/lineChannelRenderer.js`
  - `src/v1/line_renderer/semanticLineMessage.js`
- insert:
  - renderer should stay deterministic
  - add richer input contract rather than more renderer heuristics

### Journey command / Task OS lane

- current owner:
  - `src/usecases/journey/handleJourneyLineCommand.js`
  - `src/usecases/journey/handleJourneyPostback.js`
  - `src/usecases/tasks/renderTaskFlexMessage.js`
- insert:
  - use existing task lane as authoritative Task OS
  - add adapter that exposes task state into assistant lane without forcing explicit commands

### Rich menu resolver lane

- current owner:
  - `src/usecases/journey/applyPersonalizedRichMenu.js`
  - `src/usecases/journey/applyRichMenuAssignment.js`
- insert:
  - bind per-turn `menu_entry_binding` into response contract
  - keep actual menu assignment separate from answer generation

### Notification / operator adjacent lanes

- current owner:
  - reminder jobs
  - notification senders
  - operator/admin surfaces
- decision:
  - keep separate from main concierge lane in phase1
  - only share contracts, not direct copy merge

## Required no-mix boundaries

1. operator / admin wording must not leak into user concierge lane
2. shell-only leaves must not be treated as final resolution copy
3. rich menu persistence must not be implemented as direct URL dumping
4. notification and reminder lanes remain adjacent, not primary concierge response owners

