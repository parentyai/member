'use strict';

const MIN_SAFE_APPLY_REGISTRY_VERSION = '2026-03-19';

const MIN_SAFE_APPLY_REGISTRY = Object.freeze({
  leaf_citypack_feedback_received: Object.freeze({
    leafId: 'leaf_citypack_feedback_received',
    primaryRoute: 'journey direct command parser',
    outputShape: 'command_ack',
    channelSurface: 'line_text',
    serviceSurface: 'line_webhook_command',
    messageType: 'text',
    literalText: 'City Packの誤り報告を受け付けました。確認後に反映します。',
    sourcePath: 'src/domain/cityPackFeedbackMessages.js#feedbackReceived'
  }),
  leaf_line_renderer_render_failure: Object.freeze({
    leafId: 'leaf_line_renderer_render_failure',
    primaryRoute: 'renderer fallback',
    outputShape: 'renderer_default_text',
    channelSurface: 'line_text',
    serviceSurface: 'line_renderer',
    messageType: 'text',
    literalText: 'メッセージを生成できませんでした。',
    sourcePath: 'src/v1/line_renderer/lineChannelRenderer.js#prepareLineMessages'
  }),
  leaf_paid_finalizer_refuse: Object.freeze({
    leafId: 'leaf_paid_finalizer_refuse',
    primaryRoute: 'paid orchestrator',
    outputShape: 'refuse_text',
    channelSurface: 'line_text',
    serviceSurface: 'assistant_paid_orchestrator',
    messageType: 'text',
    literalText: 'この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを整理します。',
    sourcePath: 'src/domain/llm/orchestrator/finalizeCandidate.js#finalizeCandidate'
  }),
  leaf_paid_readiness_clarify_default: Object.freeze({
    leafId: 'leaf_paid_readiness_clarify_default',
    primaryRoute: 'paid orchestrator',
    outputShape: 'clarify_prompt',
    channelSurface: 'line_text',
    serviceSurface: 'assistant_paid,faq_http_json',
    messageType: 'text',
    literalText: 'まず対象手続きと期限を1つずつ教えてください。そこから案内を具体化します。',
    sourcePath: 'src/domain/llm/quality/applyAnswerReadinessDecision.js#applyAnswerReadinessDecision'
  }),
  leaf_paid_readiness_hedge_suffix: Object.freeze({
    leafId: 'leaf_paid_readiness_hedge_suffix',
    primaryRoute: 'paid orchestrator',
    outputShape: 'disclaimer_block',
    channelSurface: 'line_text',
    serviceSurface: 'assistant_paid,faq_http_json',
    messageType: 'text',
    literalText: '補足: 情報は更新されるため、最終確認をお願いします。',
    sourcePath: 'src/domain/llm/quality/applyAnswerReadinessDecision.js#applyAnswerReadinessDecision'
  }),
  leaf_paid_readiness_refuse_default: Object.freeze({
    leafId: 'leaf_paid_readiness_refuse_default',
    primaryRoute: 'paid orchestrator',
    outputShape: 'refuse_text',
    channelSurface: 'line_text',
    serviceSurface: 'assistant_paid,faq_http_json',
    messageType: 'text',
    literalText: 'この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを一緒に整理します。',
    sourcePath: 'src/domain/llm/quality/applyAnswerReadinessDecision.js#applyAnswerReadinessDecision'
  }),
  leaf_webhook_guard_missing_reply_fallback: Object.freeze({
    leafId: 'leaf_webhook_guard_missing_reply_fallback',
    primaryRoute: 'POST /webhook/line top-level',
    outputShape: 'fallback_text',
    channelSurface: 'line_text',
    serviceSurface: 'line_webhook',
    messageType: 'text',
    literalText: '状況を整理しながら進めましょう。まずは優先する手続きを1つ決めるのがおすすめです。',
    sourcePath: 'src/routes/webhookLine.js#guardPaidMainReplyText'
  }),
  leaf_webhook_readiness_clarify: Object.freeze({
    leafId: 'leaf_webhook_readiness_clarify',
    primaryRoute: 'POST /webhook/line top-level',
    outputShape: 'clarify_prompt',
    channelSurface: 'line_text',
    serviceSurface: 'line_webhook',
    messageType: 'text',
    literalText: 'まず対象手続きと期限を1つずつ教えてください。そこから具体的な次の一手を整理します。',
    sourcePath: 'src/routes/webhookLine.js#handleAssistantMessage'
  }),
  leaf_webhook_readiness_refuse: Object.freeze({
    leafId: 'leaf_webhook_readiness_refuse',
    primaryRoute: 'POST /webhook/line top-level',
    outputShape: 'refuse_text',
    channelSurface: 'line_text',
    serviceSurface: 'line_webhook',
    messageType: 'text',
    literalText: 'この内容は安全に断定できないため、公式窓口で最終確認をお願いします。必要なら確認項目を整理します。',
    sourcePath: 'src/routes/webhookLine.js#handleAssistantMessage'
  }),
  leaf_webhook_retrieval_failure_fallback: Object.freeze({
    leafId: 'leaf_webhook_retrieval_failure_fallback',
    primaryRoute: 'POST /webhook/line top-level',
    outputShape: 'fallback_text',
    channelSurface: 'line_text',
    serviceSurface: 'line_webhook',
    messageType: 'text',
    literalText: '関連情報を取得できませんでした。',
    sourcePath: 'src/routes/webhookLine.js#replyWithFreeRetrieval'
  }),
  leaf_webhook_synthetic_ack: Object.freeze({
    leafId: 'leaf_webhook_synthetic_ack',
    primaryRoute: 'POST /webhook/line top-level',
    outputShape: 'command_ack',
    channelSurface: 'line_text',
    serviceSurface: 'line_webhook',
    messageType: 'text',
    literalText: '受け取りました。続けて状況を一緒に整理します。',
    sourcePath: 'src/routes/webhookLine.js#syntheticAssistant'
  }),
  leaf_welcome_message: Object.freeze({
    leafId: 'leaf_welcome_message',
    primaryRoute: 'welcome push flow',
    outputShape: 'welcome_text',
    channelSurface: 'line_text',
    serviceSurface: 'welcome_notification',
    messageType: 'text',
    literalText: '公式からのご案内はすべてこちらのLINEでお送りします。重要なお知らせは「公式連絡」からご確認ください。',
    sourcePath: 'src/usecases/notifications/sendWelcomeMessage.js#WELCOME_TEXT'
  })
});

const SAFE_MIN_APPLY_LEAF_IDS = Object.freeze(Object.keys(MIN_SAFE_APPLY_REGISTRY));

function getMinSafeApplyLeafRecord(leafId) {
  return MIN_SAFE_APPLY_REGISTRY[leafId] || null;
}

function getMinSafeApplyLiteral(leafId, fallbackLiteral) {
  const record = getMinSafeApplyLeafRecord(leafId);
  if (record && typeof record.literalText === 'string' && record.literalText.trim()) {
    return record.literalText;
  }
  return fallbackLiteral;
}

function buildMinSafeApplyTextPayload(leafId) {
  const record = getMinSafeApplyLeafRecord(leafId);
  if (!record) {
    throw new Error(`unknown min safe apply leaf: ${leafId}`);
  }
  return {
    type: record.messageType,
    text: record.literalText
  };
}

module.exports = {
  MIN_SAFE_APPLY_REGISTRY_VERSION,
  MIN_SAFE_APPLY_REGISTRY,
  SAFE_MIN_APPLY_LEAF_IDS,
  getMinSafeApplyLeafRecord,
  getMinSafeApplyLiteral,
  buildMinSafeApplyTextPayload
};
