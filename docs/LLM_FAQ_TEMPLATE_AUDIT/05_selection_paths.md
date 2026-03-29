# 05 Selection Paths

## Core route families

### 1. Canonical LINE webhook
- `POST /webhook/line`
- path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/index.js:513` -> `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/index.js:541` -> `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js:4883`
- major branching:
  - signature / JSON / kill switch guard
  - event type (`message` / `postback`)
  - journey command path vs assistant path
  - assistant free vs paid tier
  - paid router / orchestrator / fallback

### 2. FAQ admin route
- `POST /api/admin/llm/faq/answer`
- path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/index.js:2622` -> `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/admin/llmFaq.js:53` -> `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/faq/answerFaqFromKb.js:800`
- blocked payload families:
  - `faq_disclaimer_templates`
  - `faq_block_action_labels`

### 3. FAQ compat route
- `POST /api/phaseLLM4/faq/answer`
- path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/index.js:3007` -> `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/phaseLLM4FaqAnswer.js:35` -> `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/faq/answerFaqFromKb.js:800`
- conditional gate:
  - `LEGACY_ROUTE_FREEZE_ENABLED`

## Assistant free path
- `handleAssistantMessage` -> free tier -> `replyWithFreeRetrieval` -> `generateFreeRetrievalReply`
- key families:
  - `free_retrieval_empty_reply`
  - `free_retrieval_ranked_reply`
  - `free_contextual_followup_domain_answers`
  - `runtime_knowledge_fallback_templates`
- guard note:
  - helper family `search_kb_replytext_templates` is **not** current runtime truth for final user output

## Assistant paid path
- `handleAssistantMessage` -> paid tier
- classifier chain:
  - `detectIntent`
  - `routeConversation`
  - optional `runPaidConversationOrchestrator`
  - otherwise `generatePaidFaqReply` or `generatePaidAssistantReply`
- key families:
  - `paid_casual_templates`
  - `paid_domain_concierge_templates`
  - `paid_assistant_conversation_format`
  - `paid_reply_guard_defaults`
  - `answer_readiness_gate_templates`
  - `required_core_facts_domain_clarify`
  - `verify_candidate_clarify_templates`
  - `finalize_candidate_fallback_templates`
  - `webhook_assistant_top_level_templates`

## Journey / task command path
- `POST /webhook/line` -> parser -> `handleJourneyLineCommand` / `handleJourneyPostback`
- key families:
  - `region_line_messages`
  - `citypack_feedback_messages`
  - `redac_membership_messages`
  - `journey_task_detail_defaults`
  - `task_flex_labels_and_buttons`
  - `journey_command_replies`

## Internal reminder / notification paths
- reminder job: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/index.js:1638` -> `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/journey/runJourneyTodoReminderJob.js:561`
- notification path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/notifications/sendNotification.js:358` -> `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/notifications/buildLineNotificationMessage.js`
- key families:
  - `journey_reminder_message`
  - `welcome_message`
  - `notification_renderer_defaults`
  - `line_surface_renderer_defaults`

## Adjacent runtime families
- `emergency_message_template`
- `ops_escalation_default_notification`

These are preset user-facing templates, but they are adjacent to the main FAQ/assistant surfaces rather than the central assistant reply path.
