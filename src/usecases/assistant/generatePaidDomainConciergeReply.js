'use strict';

const { buildConciergeContextSnapshot } = require('./concierge/composeConciergeReply');

const FORBIDDEN_REPLY_PATTERN = /(FAQ候補|CityPack候補|根拠キー|score=|-\s*\[\]|関連情報です)/g;

const DOMAIN_SPECS = Object.freeze({
  housing: {
    situationLine: '住まい探しの相談ですね。',
    defaultActions: ['希望条件を3つに絞る', '予算と入居時期を決める', '審査に必要な書類を確認する'],
    pitfall: '審査に必要な書類が不足すると契約手続きが止まりやすくなります。',
    question: '希望エリアや入居時期が分かれば、次の一手を具体化できます。'
  },
  school: {
    situationLine: '学校手続きの相談ですね。',
    defaultActions: ['学区と対象校の条件を確認する', '必要書類を先に揃える', '申請期限と面談日程を確定する'],
    pitfall: '提出書類の不足や期限超過で入学手続きが止まりやすくなります。',
    question: 'お子さんの学年と希望エリアが分かれば、優先順を具体化できます。'
  },
  ssn: {
    situationLine: 'SSN手続きの相談ですね。',
    defaultActions: ['申請条件と本人確認書類を確認する', '申請窓口の予約可否を確認する', '受領までの待機期間を見積もる'],
    pitfall: '本人確認書類の不備があると再訪が必要になりやすくなります。',
    question: '現在の在留ステータスが分かれば、手順を具体化できます。'
  },
  banking: {
    situationLine: '銀行口座まわりの相談ですね。',
    defaultActions: ['口座種別を1つ決める', '必要書類と住所証明の条件を確認する', '初回入金と利用開始日を決める'],
    pitfall: '住所証明の条件が合わないと口座開設が遅れやすくなります。',
    question: '利用したい銀行や用途が分かれば、次の一手を絞れます。'
  },
  general: {
    situationLine: 'いまの状況を短く整理します。',
    defaultActions: ['優先したい手続きを1つ決める', '期限を1つ確認する', '不足情報を1つだけ埋める'],
    pitfall: '優先順位が曖昧だと手続きが分散しやすくなります。',
    question: 'まず最優先の手続きを1つ教えてください。'
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
    return '帰任時期が分かれば、住居関連の優先順位を具体化できます。';
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

function buildNaturalReply(parts) {
  const payload = parts && typeof parts === 'object' ? parts : {};
  const spec = DOMAIN_SPECS[payload.domainIntent] || DOMAIN_SPECS.general;
  const lines = [sanitizeReplyLine(payload.situationLine) || spec.situationLine];
  const actions = normalizeActions(payload.nextActions, 3);
  if (actions.length) {
    lines.push('まずは次の一手から進めましょう。');
    actions.forEach((action) => {
      lines.push(`・${action}`);
    });
  }
  const pitfall = sanitizeReplyLine(payload.pitfall) || spec.pitfall;
  if (pitfall) lines.push(`多くの人が詰まりやすいのは ${pitfall}`);
  const question = sanitizeReplyLine(payload.followupQuestion);
  if (question) lines.push(question);
  return trimForLineMessage(lines.filter(Boolean).join('\n'));
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

  const suggestedAtoms = decision && decision.suggestedAtoms && typeof decision.suggestedAtoms === 'object'
    ? decision.suggestedAtoms
    : {};
  const mergedActions = normalizeActions([]
    .concat(Array.isArray(suggestedAtoms.nextActions) ? suggestedAtoms.nextActions : [])
    .concat(buildContextActions(conciergeContext))
    .concat(spec.defaultActions), 3);
  const reasonKeys = normalizeReasonKeys(
    decision && Array.isArray(decision.opportunityReasonKeys) ? decision.opportunityReasonKeys : [],
    domainIntent
  );

  return {
    ok: true,
    domainIntent,
    conversationMode: 'concierge',
    opportunityType: decision && typeof decision.opportunityType === 'string' && decision.opportunityType.trim()
      ? decision.opportunityType
      : 'action',
    opportunityReasonKeys: reasonKeys,
    interventionBudget: 1,
    replyText: buildNaturalReply({
      domainIntent,
      situationLine: spec.situationLine,
      nextActions: mergedActions,
      pitfall: suggestedAtoms.pitfall || spec.pitfall,
      followupQuestion: suggestedAtoms.question || buildFollowupQuestion(domainIntent, conciergeContext)
    }),
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
