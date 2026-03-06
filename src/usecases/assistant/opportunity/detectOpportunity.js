'use strict';

const { detectMessagePosture } = require('./detectMessagePosture');
const { buildOpportunityDecision } = require('./opportunitySchemas');
const { normalizeConversationIntent } = require('../../../domain/llm/router/normalizeConversationIntent');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeTasks(value) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const key = normalizeText(item.key || item.title || item.id);
    if (!key) return;
    const status = normalizeText(item.status || 'open').toLowerCase() || 'open';
    out.push({
      key,
      status,
      due: normalizeText(item.due || item.dueAt || item.dueDate) || null
    });
  });
  return out.slice(0, 3);
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    if (parsed instanceof Date && Number.isFinite(parsed.getTime())) return parsed.getTime();
  }
  return null;
}

function buildActionAtoms(tasks, dueSoonTask) {
  const nextActions = [];
  const first = Array.isArray(tasks) && tasks[0] ? tasks[0] : null;
  if (first) nextActions.push(`${first.key} の優先度と期限を確認する`);
  if (dueSoonTask && dueSoonTask.key) nextActions.push(`${dueSoonTask.key} を今日中に着手する`);
  nextActions.push('必要書類を1つにまとめる');
  return {
    nextActions: Array.from(new Set(nextActions)).slice(0, 3),
    pitfall: '優先順位が曖昧だと締切に遅れやすくなります。',
    question: 'まず最優先の手続きを1つだけ決めますか？'
  };
}

function buildBlockedAtoms(blockedTask) {
  const nextActions = [];
  if (blockedTask && blockedTask.key) nextActions.push(`${blockedTask.key} の詰まり要因を1つ特定する`);
  nextActions.push('不足情報を1つだけ埋める');
  nextActions.push('代替ルートを1つ確認する');
  return {
    nextActions: Array.from(new Set(nextActions)).slice(0, 3),
    pitfall: '詰まりを放置すると他タスクが連鎖的に遅れます。',
    question: 'どこで止まっているかを一言で教えてください。'
  };
}

function buildLifeAtoms(phase) {
  const isReturn = phase === 'return';
  return {
    nextActions: isReturn
      ? ['帰任前の必須手続きを3つに絞る', '税務と住居の締切を確認する', '引継ぎの連絡先を整理する']
      : ['移動前に必須手続きを確認する', '週末で進める手続きを1つ選ぶ', '来週の期限タスクを先に抑える'],
    pitfall: '生活イベント直前は手続き漏れが起きやすくなります。',
    question: '今週中に終わらせたい手続きはどれですか？'
  };
}

function buildHousingAtoms(topTasks, blockedTask, dueSoonTask) {
  const nextActions = [];
  if (blockedTask && blockedTask.key) {
    nextActions.push(`${blockedTask.key} に必要な書類を先に確定する`);
  }
  if (dueSoonTask && dueSoonTask.key) {
    nextActions.push(`${dueSoonTask.key} の期限と担当窓口を確認する`);
  }
  topTasks.forEach((task) => {
    if (!task || !task.key) return;
    nextActions.push(`${task.key} の条件を整理する`);
  });
  nextActions.push('希望条件を3つに絞る');
  nextActions.push('予算と入居時期を先に決める');
  return {
    nextActions: Array.from(new Set(nextActions)).slice(0, 3),
    pitfall: '審査に必要な書類が不足すると契約手続きが止まりやすくなります。',
    question: '希望エリアと入居時期が分かれば、次の一手を具体化できます。'
  };
}

function detectOpportunity(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const userTier = normalizeText(payload.userTier).toLowerCase() || 'free';
  const llmConciergeEnabled = payload.llmConciergeEnabled === true;
  const journeyPhase = normalizeText(payload.journeyPhase).toLowerCase();
  const topTasks = normalizeTasks(payload.topTasks);
  const blockedTask = payload.blockedTask && typeof payload.blockedTask === 'object'
    ? normalizeTasks([payload.blockedTask])[0] || null
    : null;
  const dueSoonTask = payload.dueSoonTask && typeof payload.dueSoonTask === 'object'
    ? normalizeTasks([payload.dueSoonTask])[0] || null
    : null;
  const posture = detectMessagePosture({ messageText: payload.messageText });
  const normalizedIntent = normalizeConversationIntent(payload.messageText);
  const isHousingIntent = normalizedIntent === 'housing' || (posture.keywordHits && posture.keywordHits.housing === true);
  const recentEngagement = payload.recentEngagement && typeof payload.recentEngagement === 'object'
    ? payload.recentEngagement
    : {};

  if (userTier !== 'paid') {
    return buildOpportunityDecision({
      conversationMode: 'casual',
      opportunityType: 'none',
      opportunityReasonKeys: ['non_paid_tier'],
      interventionBudget: 0,
      suggestedAtoms: { nextActions: [], pitfall: null, question: null }
    });
  }

  if (!isHousingIntent && (posture.isGreeting || posture.isSmalltalk)) {
    return buildOpportunityDecision({
      conversationMode: 'casual',
      opportunityType: 'none',
      opportunityReasonKeys: posture.isGreeting ? ['greeting_detected'] : ['smalltalk_detected'],
      interventionBudget: 0,
      suggestedAtoms: { nextActions: [], pitfall: null, question: null }
    });
  }

  const reasons = [];
  let opportunityType = 'none';
  let suggestedAtoms = { nextActions: [], pitfall: null, question: null };

  const hasBlockedSignal = Boolean(
    (blockedTask && blockedTask.key)
    || posture.keywordHits.blocked
  );
  const dueSoonMs = toMillis(dueSoonTask && dueSoonTask.due);
  const hasDueSoonSignal = Boolean(Number.isFinite(dueSoonMs) && dueSoonMs <= (Date.now() + (7 * 24 * 60 * 60 * 1000)));
  const hasActionSignal = Boolean(isHousingIntent || posture.keywordHits.action || hasDueSoonSignal || topTasks.length > 0);
  const hasLifeSignal = Boolean(posture.keywordHits.life || journeyPhase === 'return');

  if (hasBlockedSignal) {
    opportunityType = 'blocked';
    reasons.push('blocked_signal');
    if (blockedTask && blockedTask.key) reasons.push('blocked_task_present');
    if (posture.keywordHits.blocked) reasons.push('blocked_keyword');
    suggestedAtoms = buildBlockedAtoms(blockedTask);
  } else if (isHousingIntent) {
    opportunityType = 'action';
    reasons.push('housing_intent');
    reasons.push('housing_intent_detected');
    suggestedAtoms = buildHousingAtoms(topTasks, blockedTask, dueSoonTask);
  } else if (hasActionSignal && (posture.keywordHits.action || hasDueSoonSignal)) {
    opportunityType = 'action';
    reasons.push('action_signal');
    if (posture.keywordHits.action) reasons.push('action_keyword');
    if (hasDueSoonSignal) reasons.push('due_soon_task_present');
    suggestedAtoms = buildActionAtoms(topTasks, dueSoonTask);
  } else if (hasLifeSignal) {
    opportunityType = 'life';
    reasons.push('life_signal');
    if (posture.keywordHits.life) reasons.push('life_keyword');
    if (journeyPhase === 'return') reasons.push('journey_phase_return');
    suggestedAtoms = buildLifeAtoms(journeyPhase);
  }

  const recentInterventions = Number.isFinite(Number(recentEngagement.recentInterventions))
    ? Number(recentEngagement.recentInterventions)
    : 0;
  const cooldownActive = recentInterventions >= 1;
  if (cooldownActive) reasons.push('intervention_cooldown_active');

  const allowIntervention = opportunityType !== 'none'
    && (!cooldownActive || isHousingIntent)
    && (llmConciergeEnabled || isHousingIntent);
  return buildOpportunityDecision({
    conversationMode: allowIntervention ? 'concierge' : 'casual',
    opportunityType,
    opportunityReasonKeys: reasons,
    interventionBudget: allowIntervention ? 1 : 0,
    suggestedAtoms
  });
}

module.exports = {
  detectOpportunity
};
