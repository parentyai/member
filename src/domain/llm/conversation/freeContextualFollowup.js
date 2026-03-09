'use strict';

const { resolveFollowupIntent } = require('../orchestrator/followupIntentResolver');

const CONTEXTUAL_DOMAINS = new Set(['housing', 'school', 'ssn', 'banking']);

const FORBIDDEN_REPLY_PATTERN = /(FAQ候補|CityPack候補|根拠キー|score=|-\s*\[\]|関連情報です)/g;

const DOMAIN_REPLY_SPECS = Object.freeze({
  housing: {
    answers: {
      docs_required: '住まい探しは、本人確認と収入確認の書類を先にそろえると進みます。',
      appointment_needed: '内見は予約制の物件が多いので、候補を絞って空き枠を先に確認しましょう。',
      next_step: '次は、希望条件を3つに絞って候補物件を3件まで減らすのが近道です。'
    },
    question: '希望エリアと入居時期は決まっていますか？'
  },
  school: {
    answers: {
      docs_required: '学校手続きは、住所証明と予防接種記録を先にそろえると止まりにくいです。',
      appointment_needed: '面談や登録は予約制の学校が多いので、対象校が決まったら空き枠を確認しましょう。',
      next_step: '次は、対象校を1校に絞って必要書類を先に確定するのが最短です。'
    },
    question: '学年と希望エリアは決まっていますか？'
  },
  ssn: {
    answers: {
      docs_required: 'SSNは、本人確認書類と在留資格が分かる書類を先にそろえるのが最優先です。',
      appointment_needed: '窓口は予約が必要な地域もあるので、最寄り窓口の予約要否を先に確認してください。',
      next_step: '次は、必要書類を1つの一覧にまとめてから窓口の予約要否を確認すると確実です。'
    },
    question: 'いまの在留ステータスは分かっていますか？'
  },
  banking: {
    answers: {
      docs_required: '口座開設は、本人確認と住所証明の2点を先にそろえると進みやすいです。',
      appointment_needed: '支店手続きは予約制のことがあるので、来店前に予約可否を確認しましょう。',
      next_step: '次は、口座種別を1つ決めて必要書類を先に確定するのが最短です。'
    },
    question: '使いたい銀行か用途は決まっていますか？'
  }
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDomainIntent(value) {
  const normalized = normalizeText(value).toLowerCase();
  return CONTEXTUAL_DOMAINS.has(normalized) ? normalized : 'general';
}

function sanitizeLine(value) {
  const text = normalizeText(value).replace(FORBIDDEN_REPLY_PATTERN, '').trim();
  if (!text) return '';
  return /[。!?？]$/.test(text) ? text : `${text}。`;
}

function trimForLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}

function resolveRecentContextDomain(recentActionRows) {
  const rows = Array.isArray(recentActionRows) ? recentActionRows : [];
  for (const row of rows) {
    const domain = normalizeDomainIntent(row && row.domainIntent);
    if (domain !== 'general') return domain;
  }
  return 'general';
}

function resolveFollowupQuestionForDomain(domainIntent) {
  const spec = DOMAIN_REPLY_SPECS[domainIntent];
  return spec ? sanitizeLine(spec.question) : '';
}

function resolveDirectAnswer(domainIntent, followupIntent) {
  const spec = DOMAIN_REPLY_SPECS[domainIntent];
  if (!spec || !spec.answers) return '';
  const answer = spec.answers[followupIntent] || '';
  return sanitizeLine(answer);
}

function resolveFreeContextualFollowup(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const recentContextDomain = resolveRecentContextDomain(payload.recentActionRows);
  if (!messageText || recentContextDomain === 'general') return null;
  const messageDomainIntent = normalizeDomainIntent(payload.messageDomainIntent);
  const contextResumeDomain = messageDomainIntent !== 'general' ? messageDomainIntent : recentContextDomain;
  if (messageText.length > 16) return null;

  const followupDecision = resolveFollowupIntent({
    messageText,
    domainIntent: contextResumeDomain
  });
  const followupIntent = followupDecision && typeof followupDecision.followupIntent === 'string'
    ? followupDecision.followupIntent
    : null;
  const followupReason = followupDecision && typeof followupDecision.reason === 'string'
    ? followupDecision.reason
    : 'none';
  if (!followupIntent) return null;
  if (followupReason === 'domain_anchored_short_followup') return null;

  const directAnswer = resolveDirectAnswer(contextResumeDomain, followupIntent);
  if (!directAnswer) return null;

  const needsQuestion = messageText.length <= 8 || followupIntent === 'next_step';
  const questionLine = needsQuestion ? resolveFollowupQuestionForDomain(contextResumeDomain) : '';
  const lines = [directAnswer];
  if (questionLine) lines.push(questionLine);
  const replyText = trimForLineMessage(lines.filter(Boolean).slice(0, 3).join('\n'));

  const baseCarry = messageDomainIntent !== 'general' ? 0.88 : 0.84;
  const contextCarryScore = Math.max(0, Math.min(1, baseCarry + 0.08));

  return {
    replyText,
    contextResumeDomain,
    followupIntent,
    reason: 'contextual_free_followup',
    qualityMeta: {
      conciseModeApplied: true,
      directAnswerApplied: true,
      clarifySuppressed: true,
      repetitionPrevented: false,
      contextCarryScore,
      repeatRiskScore: 0.12
    }
  };
}

module.exports = {
  resolveFreeContextualFollowup
};
