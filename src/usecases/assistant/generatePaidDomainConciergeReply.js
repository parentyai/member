'use strict';

const { buildConciergeContextSnapshot } = require('./concierge/composeConciergeReply');
const { resolveFollowupIntent } = require('../../domain/llm/orchestrator/followupIntentResolver');

const FORBIDDEN_REPLY_PATTERN = /(FAQ候補|CityPack候補|根拠キー|score=|-\s*\[\]|関連情報です)/g;
const TASK_LABEL_MAP = Object.freeze({
  school_registration: '学校登録手続き',
  school_enrollment: '入学手続き',
  ssn_application: 'SSN申請手続き',
  housing_search: '住まい探し',
  bank_account_opening: '口座開設手続き'
});

const DOMAIN_SPECS = Object.freeze({
  housing: {
    situationLine: '住まい探しですね。',
    defaultAction: '希望条件を3つに絞る',
    pitfall: '審査に必要な書類が不足すると契約手続きが止まりやすくなります。',
    question: '希望エリアと入居時期を教えてもらえますか？',
    directAnswers: {
      docs_required: '住居契約では、本人確認と収入確認に使う書類を先にそろえるのが近道です。',
      appointment_needed: '内見は予約が必要な物件が多いので、候補を絞って先に空き枠を確認しましょう。',
      next_step: '次は、条件を1つ減らして候補物件を3件まで絞ると進みやすいです。'
    }
  },
  school: {
    situationLine: '学校手続きですね。',
    defaultAction: '学区と対象校の条件を確認する',
    pitfall: '提出書類の不足や期限超過で入学手続きが止まりやすくなります。',
    question: '学年と希望エリアを教えてもらえますか？',
    directAnswers: {
      docs_required: '学校手続きは、住所証明と予防接種記録を先にそろえると止まりにくいです。',
      appointment_needed: '面談や学校登録は予約制のことが多いので、対象校が決まったら先に空き枠を確認しましょう。',
      next_step: '学校手続きの次は、対象校を1校に絞って必要書類を先に確定するのが最短です。'
    }
  },
  ssn: {
    situationLine: 'SSN手続きですね。',
    defaultAction: '申請条件と本人確認書類を確認する',
    pitfall: '本人確認書類の不備があると再訪が必要になりやすくなります。',
    question: 'いまの在留ステータスを教えてもらえますか？',
    directAnswers: {
      docs_required: 'SSNは本人確認書類と在留資格が分かる書類を先にそろえるのが最優先です。',
      appointment_needed: '窓口は予約が必要な地域もあるので、最寄り窓口の予約要否を先に確認しましょう。',
      next_step: '次は、必要書類を1つの一覧にまとめてから窓口の予約要否を確認するのが確実です。'
    }
  },
  banking: {
    situationLine: '銀行口座まわりですね。',
    defaultAction: '口座種別を1つ決める',
    pitfall: '住所証明の条件が合わないと口座開設が遅れやすくなります。',
    question: '使いたい銀行か用途を教えてもらえますか？',
    directAnswers: {
      docs_required: '口座開設は本人確認と住所証明の2点を先にそろえると早いです。',
      appointment_needed: '支店手続きは予約制のことがあるので、来店前に予約可否を確認してください。',
      next_step: '次は、口座種別を1つ決めて必要書類を先に確定するのが最短です。'
    }
  },
  general: {
    situationLine: 'いまの状況を整理します。',
    defaultAction: '今すぐ進める手続きを1つ決める',
    pitfall: '優先順位が曖昧だと手続きが分散しやすくなります。',
    question: 'いま一番困っている手続きを1つだけ教えてください。',
    directAnswers: {
      docs_required: '必要書類は、まず最優先の手続きに必要なものだけ先に整理すると進めやすいです。',
      appointment_needed: '予約要否は手続きごとに違うので、最優先手続きの窓口だけ先に確認しましょう。',
      next_step: '次は、最優先手続きを1つ決めて期限を確認するのが最短です。'
    }
  }
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function trimForLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 420 ? `${text.slice(0, 420)}…` : text;
}

function sanitizeReplyLine(value) {
  return normalizeText(value).replace(FORBIDDEN_REPLY_PATTERN, '');
}

function normalizeActions(value, limit) {
  const rows = Array.isArray(value) ? value : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(1, Math.floor(Number(limit))) : 3;
  const out = [];
  rows.forEach((item) => {
    const normalized = sanitizeReplyLine(item);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, max);
}

function formatTaskLabel(task) {
  if (!task || typeof task !== 'object') return '';
  const key = normalizeText(task.key || task.title || task.id);
  if (!key) return '';
  const mapped = TASK_LABEL_MAP[key.toLowerCase()];
  if (mapped) return mapped;
  return key.replace(/_/g, ' ');
}

function resolveDomainIntent(value) {
  const intent = normalizeText(value).toLowerCase();
  if (intent && Object.prototype.hasOwnProperty.call(DOMAIN_SPECS, intent)) return intent;
  return 'general';
}

function buildContextActions(context) {
  const source = context && typeof context === 'object' ? context : {};
  const nextActions = [];
  if (source.blockedTask) {
    const label = formatTaskLabel(source.blockedTask);
    if (label) nextActions.push(`${label}の詰まり要因を1つ特定する`);
  }
  if (source.dueSoonTask) {
    const label = formatTaskLabel(source.dueSoonTask);
    if (label) nextActions.push(`${label}の期限と窓口を確認する`);
  }
  if (Array.isArray(source.topTasks)) {
    source.topTasks.forEach((task) => {
      const label = formatTaskLabel(task);
      if (!label) return;
      nextActions.push(`${label}の条件を整理する`);
    });
  }
  return nextActions;
}

function buildFollowupQuestion(domainIntent, context) {
  const spec = DOMAIN_SPECS[domainIntent] || DOMAIN_SPECS.general;
  const phase = normalizeText(context && context.phase).toLowerCase();
  if (domainIntent === 'housing' && phase === 'return') {
    return '帰任時期を教えてもらえますか？';
  }
  return spec.question;
}

function normalizeReasonKeys(value, domainIntent) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  const domainReason = `${domainIntent}_intent`;
  if (!out.includes(domainReason) && domainIntent !== 'general') out.push(domainReason);
  return out.slice(0, 8);
}

function ensureSentence(value) {
  const line = sanitizeReplyLine(value);
  if (!line) return '';
  if (/[。！？!?]$/.test(line)) return line;
  return `${line}。`;
}

function buildActionLine(action) {
  const normalized = sanitizeReplyLine(action);
  if (!normalized) return '';
  if (/^(次|まず|先に)/.test(normalized)) return ensureSentence(normalized);
  return ensureSentence(`次は${normalized}`);
}

function detectRepeatedFollowupIntent(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const followupIntent = normalizeText(payload.followupIntent).toLowerCase();
  const rows = Array.isArray(payload.recentFollowupIntents) ? payload.recentFollowupIntents : [];
  if (!followupIntent) return false;
  let streak = 0;
  rows.slice(0, 3).forEach((item) => {
    const normalized = normalizeText(item).toLowerCase();
    if (normalized && normalized === followupIntent) streak += 1;
  });
  return streak >= 1;
}

function resolveFollowupIntentForDomain(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const explicit = normalizeText(payload.followupIntent).toLowerCase();
  if (explicit === 'docs_required' || explicit === 'appointment_needed' || explicit === 'next_step') {
    return explicit;
  }
  const decision = resolveFollowupIntent({
    messageText: payload.messageText,
    domainIntent: payload.domainIntent
  });
  return decision && typeof decision.followupIntent === 'string' ? decision.followupIntent : null;
}

function buildConciseReply(parts) {
  const payload = parts && typeof parts === 'object' ? parts : {};
  const spec = DOMAIN_SPECS[payload.domainIntent] || DOMAIN_SPECS.general;
  const followupIntent = payload.followupIntent || null;
  const repeatedFollowupIntent = payload.repeatedFollowupIntent === true;
  const directAnswers = spec.directAnswers && typeof spec.directAnswers === 'object' ? spec.directAnswers : {};
  const repeatedAnswerByIntent = {
    docs_required: '同じ書類確認なら、次は不足しやすい書類を1つずつ潰すのが最短です。',
    appointment_needed: '予約の確認を続けるなら、最寄り窓口を1つ決めて予約可否を確定しましょう。',
    next_step: '同じ話題を進めるなら、期限が近い手続きを1つに固定すると進みます。'
  };
  const resolvedPrimaryLine = (
    followupIntent
      ? (repeatedFollowupIntent
        ? repeatedAnswerByIntent[followupIntent] || directAnswers[followupIntent]
        : directAnswers[followupIntent])
      : (payload.situationLine || spec.situationLine)
  );
  const primaryLine = ensureSentence(resolvedPrimaryLine);
  const actions = normalizeActions(payload.nextActions, 3);
  const actionLine = buildActionLine(actions[0] || spec.defaultAction);
  const pitfall = ensureSentence(`詰まりやすいのは ${sanitizeReplyLine(payload.pitfall) || spec.pitfall}`);
  const question = sanitizeReplyLine(payload.followupQuestion);
  const questionLine = question
    ? (/[?？]$/.test(question) ? question : `${question}？`)
    : '';

  const lines = [primaryLine];
  if (actionLine && actionLine !== primaryLine) lines.push(actionLine);
  if (questionLine) {
    lines.push(questionLine);
  } else if (pitfall) {
    lines.push(pitfall);
  }
  const replyText = trimForLineMessage(lines.filter(Boolean).slice(0, 3).join('\n'));
  return {
    replyText,
    atoms: {
      situationLine: primaryLine,
      nextActions: actionLine && actionLine !== primaryLine ? [actionLine] : [],
      pitfall: questionLine ? '' : pitfall,
      followupQuestion: questionLine || ''
    }
  };
}

function buildDomainAuditMeta(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const blockedReason = normalizeText(payload.blockedReason);
  const blockedReasons = blockedReason ? [blockedReason] : [];
  return {
    topic: payload.domainIntent || 'general',
    mode: 'B',
    userTier: 'paid',
    citationRanks: [],
    urlCount: 0,
    urls: [],
    guardDecisions: [],
    blockedReasons,
    injectionFindings: false,
    evidenceNeed: 'none',
    evidenceOutcome: blockedReasons.length ? 'BLOCKED' : 'SUPPORTED',
    chosenAction: null,
    contextVersion: 'concierge_ctx_v1',
    featureHash: null,
    postRenderLint: { findings: [], modified: false },
    contextSignature: null,
    contextualBanditEnabled: false,
    contextualFeatures: null,
    counterfactualSelectedArmId: null,
    counterfactualSelectedRank: null,
    counterfactualTopArms: [],
    counterfactualEval: null
  };
}

function generatePaidDomainConciergeReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const domainIntent = resolveDomainIntent(payload.domainIntent);
  const spec = DOMAIN_SPECS[domainIntent] || DOMAIN_SPECS.general;
  const contextSnapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? payload.contextSnapshot
    : null;
  const conciergeContext = buildConciergeContextSnapshot(contextSnapshot);
  const decision = payload.opportunityDecision && typeof payload.opportunityDecision === 'object'
    ? payload.opportunityDecision
    : null;
  const followupIntent = resolveFollowupIntentForDomain({
    followupIntent: payload.followupIntent,
    messageText: payload.messageText,
    domainIntent
  });
  const repeatedFollowupIntent = detectRepeatedFollowupIntent({
    followupIntent,
    recentFollowupIntents: payload.recentFollowupIntents
  });

  const suggestedAtoms = decision && decision.suggestedAtoms && typeof decision.suggestedAtoms === 'object'
    ? decision.suggestedAtoms
    : {};
  const mergedActions = normalizeActions([]
    .concat(Array.isArray(suggestedAtoms.nextActions) ? suggestedAtoms.nextActions : [])
    .concat(buildContextActions(conciergeContext))
    .concat(spec.defaultAction), 3);
  const reasonKeys = normalizeReasonKeys(
    decision && Array.isArray(decision.opportunityReasonKeys) ? decision.opportunityReasonKeys : [],
    domainIntent
  );

  const concise = buildConciseReply({
    domainIntent,
    situationLine: spec.situationLine,
    nextActions: mergedActions,
    pitfall: suggestedAtoms.pitfall || spec.pitfall,
    followupQuestion: suggestedAtoms.question || buildFollowupQuestion(domainIntent, conciergeContext),
    followupIntent,
    repeatedFollowupIntent
  });

  return {
    ok: true,
    domainIntent,
    conversationMode: 'concierge',
    opportunityType: decision && typeof decision.opportunityType === 'string' && decision.opportunityType.trim()
      ? decision.opportunityType
      : 'action',
    opportunityReasonKeys: reasonKeys,
    interventionBudget: 1,
    followupIntent,
    conciseModeApplied: true,
    replyText: concise.replyText,
    atoms: concise.atoms,
    auditMeta: buildDomainAuditMeta({
      domainIntent,
      blockedReason: payload.blockedReason || null
    })
  };
}

module.exports = {
  generatePaidDomainConciergeReply,
  FORBIDDEN_REPLY_PATTERN
};
