'use strict';

const { buildResolutionResponse } = require('./buildResolutionResponse');
const { feedbackReceived, feedbackUsage } = require('../../cityPackFeedbackMessages');

const PHASE1_CONCIERGE_LANES = new Set([
  'paid_domain',
  'paid_orchestrated',
  'paid_main',
  'paid_casual',
  'free_retrieval',
  'welcome',
  'citypack_feedback_received',
  'citypack_feedback_usage',
  'service_ack'
]);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function isPhase1ConciergeLane(value) {
  return PHASE1_CONCIERGE_LANES.has(normalizeText(value));
}

function buildConversationConciergeEnvelope(params) {
  const payload = params && typeof params === 'object' ? params : {};
  if (!isPhase1ConciergeLane(payload.lane)) return null;
  return buildResolutionResponse(payload);
}

function buildWelcomeConciergeText(baseText) {
  const resolution = buildConversationConciergeEnvelope({
    lane: 'welcome',
    baseReplyText: normalizeText(baseText),
    answerSummary: normalizeText(baseText),
    whyItMatters: '通知と次の手続き導線をこのLINEでまとめて確認できます。',
    nextBestAction: 'まずは「TODO一覧」か「今やる」で進める手続きを1つ確認してください。',
    menuBucketPreferred: 'todo_list',
    taskTitle: '最初のTODOを確認する',
    taskId: 'welcome_todo_entry',
    taskStatus: 'suggested',
    topic: 'welcome'
  });
  return resolution ? resolution.replyText : normalizeText(baseText);
}

function buildCityPackFeedbackReceivedText() {
  const resolution = buildConversationConciergeEnvelope({
    lane: 'citypack_feedback_received',
    baseReplyText: feedbackReceived(),
    answerSummary: feedbackReceived(),
    whyItMatters: '報告内容が分かるほど、City Packの確認と修正が早くなります。',
    nextBestAction: '補足があれば、対象箇所と気づいた点を1件ずつそのまま送ってください。',
    topic: 'city_pack_feedback'
  });
  return resolution ? resolution.replyText : feedbackReceived();
}

function buildCityPackFeedbackUsageText() {
  const resolution = buildConversationConciergeEnvelope({
    lane: 'citypack_feedback_usage',
    baseReplyText: feedbackUsage(),
    answerSummary: feedbackUsage(),
    whyItMatters: '対象箇所が分かると、確認すべきCity Packをすぐ特定できます。',
    nextBestAction: '誤りや不足を1件だけ書いて送ってください。',
    topic: 'city_pack_feedback',
    menuBucketPreferred: 'support_guide',
    taskTitle: 'City Packの修正点を1件送る',
    taskId: 'citypack_feedback_submit',
    taskStatus: 'suggested'
  });
  return resolution ? resolution.replyText : feedbackUsage();
}

function buildServiceAckText(baseText) {
  const text = normalizeText(baseText) || '確認しています。少しお待ちください。';
  const resolution = buildConversationConciergeEnvelope({
    lane: 'service_ack',
    baseReplyText: text,
    answerSummary: text,
    whyItMatters: '内容を安全に組み立ててから返答するため、少しだけ確認しています。',
    topic: 'service_ack'
  });
  return resolution ? resolution.replyText : text;
}

module.exports = {
  PHASE1_CONCIERGE_LANES,
  isPhase1ConciergeLane,
  buildConversationConciergeEnvelope,
  buildWelcomeConciergeText,
  buildCityPackFeedbackReceivedText,
  buildCityPackFeedbackUsageText,
  buildServiceAckText
};
