# Scope Lock

| leaf_id | current_source_file | current_source_symbol | current_output_shape | registry_entry_exists | bridge_target_file | bridge_method |
| --- | --- | --- | --- | --- | --- | --- |
| leaf_citypack_feedback_received | `src/domain/cityPackFeedbackMessages.js` | `feedbackReceived` | `command_ack` | yes | `src/domain/cityPackFeedbackMessages.js` | `helper_wrapper_with_fallback` |
| leaf_line_renderer_render_failure | `src/v1/line_renderer/lineChannelRenderer.js` | `prepareLineMessages` | `renderer_default_text` | yes | `src/v1/line_renderer/lineChannelRenderer.js` | `renderer_text_selection_with_fallback` |
| leaf_paid_finalizer_refuse | `src/domain/llm/orchestrator/finalizeCandidate.js` | `finalizeCandidate` | `refuse_text` | yes | `src/domain/llm/orchestrator/finalizeCandidate.js` | `direct_literal_lookup_with_fallback` |
| leaf_paid_readiness_clarify_default | `src/domain/llm/quality/applyAnswerReadinessDecision.js` | `applyAnswerReadinessDecision` | `clarify_prompt` | yes | `src/domain/llm/quality/applyAnswerReadinessDecision.js` | `direct_literal_lookup_with_fallback` |
| leaf_paid_readiness_hedge_suffix | `src/domain/llm/quality/applyAnswerReadinessDecision.js` | `applyAnswerReadinessDecision` | `disclaimer_block` | yes | `src/domain/llm/quality/applyAnswerReadinessDecision.js` | `direct_literal_lookup_with_fallback` |
| leaf_paid_readiness_refuse_default | `src/domain/llm/quality/applyAnswerReadinessDecision.js` | `applyAnswerReadinessDecision` | `refuse_text` | yes | `src/domain/llm/quality/applyAnswerReadinessDecision.js` | `direct_literal_lookup_with_fallback` |
| leaf_webhook_guard_missing_reply_fallback | `src/routes/webhookLine.js` | `guardPaidMainReplyText` | `fallback_text` | yes | `src/routes/webhookLine.js` | `helper_wrapper_with_fallback` |
| leaf_webhook_readiness_clarify | `src/routes/webhookLine.js` | `handleAssistantMessage` readiness apply path | `clarify_prompt` | yes | `src/routes/webhookLine.js` | `direct_literal_lookup_with_fallback` |
| leaf_webhook_readiness_refuse | `src/routes/webhookLine.js` | `handleAssistantMessage` readiness apply path | `refuse_text` | yes | `src/routes/webhookLine.js` | `direct_literal_lookup_with_fallback` |
| leaf_webhook_retrieval_failure_fallback | `src/routes/webhookLine.js` | `replyWithFreeRetrieval` | `fallback_text` | yes | `src/routes/webhookLine.js` | `helper_wrapper_with_fallback` |
| leaf_webhook_synthetic_ack | `src/routes/webhookLine.js` | `synthetic assistant reply path` | `command_ack` | yes | `src/routes/webhookLine.js` | `direct_literal_lookup_with_fallback` |
| leaf_welcome_message | `src/usecases/notifications/sendWelcomeMessage.js` | `WELCOME_TEXT` | `welcome_text` | yes | `src/usecases/notifications/sendWelcomeMessage.js` | `direct_literal_lookup_with_fallback` |
