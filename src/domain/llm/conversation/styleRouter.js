'use strict';

const { STYLES } = require('./responseStyles');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function has(text, regex) {
  return regex.test(normalizeText(text));
}

function normalizeHour(value) {
  const hour = Number(value);
  if (!Number.isFinite(hour)) return null;
  const floored = Math.floor(hour);
  if (floored < 0 || floored > 23) return null;
  return floored;
}

function selectConversationStyle(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const topic = normalizeText(payload.topic).toLowerCase() || 'general';
  const question = normalizeText(payload.question);
  const urgency = normalizeText(payload.urgency).toLowerCase();
  const journeyPhase = normalizeText(payload.journeyPhase).toLowerCase();
  const userTier = normalizeText(payload.userTier).toLowerCase() || 'free';
  const messageLength = Number.isFinite(Number(payload.messageLength))
    ? Number(payload.messageLength)
    : question.length;
  const hour = normalizeHour(payload.timeOfDay);

  const urgent = urgency === 'high' || has(question, /(至急|urgent|本日中|すぐ|期限切れ|間に合)/i);
  const confused = has(question, /(わからない|分からない|混乱|不明|詰まって|どうすれば)/i);
  const deadline = has(question, /(期限|期日|までに|いつまで|deadline)/i);
  const regulationLike = ['regulation', 'medical', 'visa', 'tax', 'school', 'pricing'].includes(topic);

  let styleId = STYLES.COACH;
  let conversationPattern = 'coach_default';

  if (urgent) {
    styleId = STYLES.QUICK;
    conversationPattern = 'urgent_quick';
  } else if (topic === 'activity') {
    styleId = STYLES.WEEKEND;
    conversationPattern = 'activity_weekend';
  } else if (regulationLike) {
    styleId = STYLES.CHECKLIST;
    conversationPattern = 'regulated_checklist';
  } else if (deadline || journeyPhase === 'pre' || journeyPhase === 'arrival') {
    styleId = STYLES.TIMELINE;
    conversationPattern = 'timeline_plan';
  } else if (confused) {
    styleId = STYLES.COACH;
    conversationPattern = 'confusion_coach';
  } else if (messageLength <= 24) {
    styleId = STYLES.CHOICE;
    conversationPattern = 'short_choice';
  } else if (topic === 'other') {
    styleId = STYLES.DEBUG;
    conversationPattern = 'other_debug';
  } else if (hour !== null && hour >= 20) {
    styleId = STYLES.STORY;
    conversationPattern = 'night_story';
  }

  return {
    styleId,
    conversationPattern,
    askClarifying: confused || deadline || messageLength < 18,
    maxActions: userTier === 'free' ? 2 : 3
  };
}

module.exports = {
  selectConversationStyle
};
