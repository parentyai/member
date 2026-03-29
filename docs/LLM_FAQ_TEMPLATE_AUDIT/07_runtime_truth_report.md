# 07 Runtime Truth Report

- reachable: **15**
- conditionally_reachable: **14**
- unconfirmed: **1**
- dead_or_test_only: **2**

## Reachable families

### reachable
- `faq_disclaimer_templates`: FAQ admin/compat routes -> answerFaqFromKb -> getDisclaimer; paid assistant path -> generatePaidAssistantReply -> getDisclaimer
- `faq_block_action_labels`: FAQ admin/compat route -> answerFaqFromKb blocked result -> fallbackActions -> Admin UI label render
- `paid_assistant_conversation_format`: paid assistant answer generation -> formatPaidReplyConversation -> webhook send
- `paid_reply_guard_defaults`: paid assistant/orchestrator output -> sanitizePaidMainReply -> finalizer -> webhook send
- `answer_readiness_gate_templates`: reply generated -> answer readiness decision applied -> clarify/refuse/hedged text returned
- `finalize_candidate_fallback_templates`: orchestrator selected candidate -> sanitizePaidMainReply -> finalizeCandidate -> applyAnswerReadinessDecision -> final text
- `webhook_assistant_top_level_templates`: POST /webhook/line -> handleLineWebhook -> handleAssistantMessage / direct command branches -> fixed ack or fallback text
- `welcome_message`: LINE webhook ensure user -> sendWelcomeMessage -> pushFn
- `region_line_messages`: LINE webhook -> direct command branch -> region message helper -> replyFn
- `citypack_feedback_messages`: LINE webhook -> city pack feedback direct command -> helper -> replyFn
- `redac_membership_messages`: LINE webhook -> membership direct command -> redacLineMessages helper -> replyFn
- `journey_task_detail_defaults`: LINE command TODO詳細 / continuation -> taskDetailSectionReply -> replyFn
- `task_flex_labels_and_buttons`: LINE command/postback -> handleJourneyLineCommand -> renderTaskFlexMessage -> flex reply
- `journey_command_replies`: LINE message/postback -> parser -> handleJourneyLineCommand / handleJourneyPostback -> fixed replyText or flex payload
- `journey_reminder_message`: internal journey reminder job -> buildReminderMessage -> pushFn

### conditionally_reachable
- `free_retrieval_empty_reply`: LINE webhook -> handleAssistantMessage -> replyWithFreeRetrieval -> generateFreeRetrievalReply -> buildEmptyReply
- `free_retrieval_ranked_reply`: LINE webhook -> handleAssistantMessage -> replyWithFreeRetrieval -> generateFreeRetrievalReply -> buildRankedReply
- `response_style_templates`: assistant packet -> styleRouter/selectResponseStyle -> responseStyles renderer -> humanized reply text
- `free_contextual_followup_domain_answers`: LINE webhook free path -> contextual domain resume -> resolveFreeContextualFollowup -> replyText
- `paid_casual_templates`: LINE webhook paid path -> routeConversation(casual) -> generatePaidCasualReply
- `paid_domain_concierge_templates`: LINE webhook paid path -> routeConversation/domain_orchestrator -> generatePaidDomainConciergeReply
- `required_core_facts_domain_clarify`: paid orchestrator -> evaluateRequiredCoreFactsGate -> clarify candidate or enforced clarify text
- `verify_candidate_clarify_templates`: paid orchestrator -> verifyCandidate -> clarify candidate / hedged candidate -> finalizeCandidate
- `runtime_knowledge_fallback_templates`: runtime knowledge assembly -> buildRuntimeKnowledgeCandidates -> candidate consumed by reply builder
- `line_surface_renderer_defaults`: assistant/journey/notification payload -> line renderer -> fallback text/template/flex defaults
- `notification_renderer_defaults`: sendNotification -> buildLineNotificationMessage -> text/template buttons LINE payload
- `blocked_reason_labels`: task blocked reason code -> blockedReasonJa label map -> downstream task/journey surface if rendered
- `emergency_message_template`: emergency usecase -> messageTemplates -> downstream bulletin/notification send path
- `ops_escalation_default_notification`: ops next action execution -> default escalation notification payload

### unconfirmed
- `policy_override_disclaimer_templates`: opsConfigRepo default LLM policy -> getDisclaimer(policy override) -> FAQ/paid paths if policy loaded

### dead_or_test_only
- `search_kb_replytext_templates`: searchFaqFromKb helper -> candidates consumed by callers; replyText itself not observed on current user-facing path
- `paid_assistant_legacy_structured_format`: paid assistant answer generation -> formatPaidReply (legacy) -> webhook send if conversation-format flag disabled

## Counterexample checks

1. String exists but no runtime route
   - detection: require upstream caller + route or renderer chain in inventory
   - avoidance: classify as `dead_or_test_only` or exclusion when chain is missing
2. Same text but different selection conditions
   - detection: compare `selection_predicates`, `decision_nodes`, and `upstream_path_human_readable`
   - avoidance: keep separate families when route/selection differs even if copy overlaps
3. Fallback / warning / disclaimer omission
   - detection: scan route finalizers, readiness gates, and renderer fallbacks
   - avoidance: keep dedicated safety/fallback families in the inventory
4. CTA / button omission
   - detection: scan label-bearing builders and Flex/template payload factories
   - avoidance: inventory fixed labels separately from dynamic payload bodies
5. Docs mistaken for runtime truth
   - detection: require code caller chain before promoting docs text into inventory
   - avoidance: keep docs-only examples in exclusions
6. Snapshot/test text mistaken for live truth
   - detection: require current runtime source path in `repo_paths`
   - avoidance: mark eval/snapshot material in exclusions or `dead_or_test_only`
7. Internal prompt mistaken for user-facing text
   - detection: inspect whether string is fed to model as `system` or `developer` prompt
   - avoidance: keep internal prompts in `09_exclusions_internal_or_test_only.md` only