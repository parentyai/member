'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeForSimilarity(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, '');
}

function similarityScore(left, right) {
  const a = normalizeForSimilarity(left);
  const b = normalizeForSimilarity(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  let overlap = 0;
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) {
    if (a[i] === b[i]) overlap += 1;
  }
  return overlap / Math.max(a.length, b.length);
}

const CLARIFY_FOLLOWUP_BY_DOMAIN = Object.freeze({
  school: Object.freeze({
    docs_required: '学校手続きなら、学年と住所エリアが分かれば必要書類をすぐ絞れます。',
    appointment_needed: '学校手続きは予約制の窓口があるため、対象校の地域を先に確認しましょう。',
    next_step: '学校手続きの次は、対象校を1校に絞って不足書類を先に潰すのが最短です。'
  }),
  ssn: Object.freeze({
    docs_required: 'SSNは在留ステータスと本人確認書類が分かれば必要書類を確定できます。',
    appointment_needed: 'SSN窓口は地域で運用差があるので、最寄り地域を先に決めましょう。',
    next_step: 'SSNの次は、必要書類を1つの一覧にまとめて窓口要件を確認するのが確実です。'
  }),
  housing: Object.freeze({
    docs_required: '住まい探しは、希望エリアが分かると必要書類の優先順位を絞れます。',
    appointment_needed: '内見予約が必要な物件が多いので、候補エリアを先に1つ決めましょう。',
    next_step: '住まい探しの次は、候補物件を3件まで絞って内見順を決めるのが最短です。'
  }),
  banking: Object.freeze({
    docs_required: '口座開設は用途と在留情報が分かると必要書類を絞れます。',
    appointment_needed: '支店ごとに予約要否が違うため、来店予定地域を先に決めましょう。',
    next_step: '口座手続きの次は、口座種別を1つ決めて必要書類を先に確定するのが最短です。'
  })
});

const CLARIFY_VARIANTS_BY_DOMAIN = Object.freeze({
  school: Object.freeze([
    '学校手続きを絞りたいので、学年か希望エリアを1つ教えてください。',
    '対象校を絞るため、学年か地域を先に1つ決めましょう。'
  ]),
  ssn: Object.freeze([
    'SSN手続きを進めるため、在留ステータスを1つ教えてください。',
    'SSN窓口を絞るため、最寄り地域を1つ教えてください。'
  ]),
  housing: Object.freeze([
    '住まい探しを進めるため、希望エリアか入居時期を1つ教えてください。',
    '候補物件を絞るため、予算帯かエリアを先に1つ決めましょう。'
  ]),
  banking: Object.freeze([
    '口座手続きを進めるため、用途か希望銀行を1つ教えてください。',
    '口座開設条件を絞るため、来店地域か口座種別を1つ教えてください。'
  ]),
  general: Object.freeze([
    '対象を絞って案内したいので、いま一番気になっている手続きを1つ教えてください。',
    'まず優先手続きを1つに絞りたいので、対象手続きと期限を教えてください。'
  ])
});

function buildClarifyReply(packet) {
  const payload = packet && typeof packet === 'object' ? packet : {};
  const domainIntent = normalizeText(payload.normalizedConversationIntent).toLowerCase() || 'general';
  const followupIntent = normalizeText(payload.followupIntent).toLowerCase();
  const byIntent = CLARIFY_FOLLOWUP_BY_DOMAIN[domainIntent];
  if (byIntent && byIntent[followupIntent]) {
    return byIntent[followupIntent];
  }
  const variants = CLARIFY_VARIANTS_BY_DOMAIN[domainIntent] || CLARIFY_VARIANTS_BY_DOMAIN.general;
  const hints = []
    .concat(Array.isArray(payload.recentResponseHints) ? payload.recentResponseHints : [])
    .concat(Array.isArray(payload.recentAssistantCommitments) ? payload.recentAssistantCommitments : [])
    .filter((item) => typeof item === 'string' && item.trim());
  const scored = variants.map((line, index) => ({
    line,
    index,
    similarity: hints.reduce((max, hint) => Math.max(max, similarityScore(line, hint)), 0)
  }));
  scored.sort((left, right) => left.similarity - right.similarity || left.index - right.index);
  return scored[0] ? scored[0].line : CLARIFY_VARIANTS_BY_DOMAIN.general[0];
}

function addHedge(text) {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  if (normalized.includes('最終確認')) return normalized;
  return `${normalized}\n\n断定を避けるため、重要な条件は公式窓口で最終確認してください。`;
}

function verifyCandidate(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const packet = payload.packet && typeof payload.packet === 'object' ? payload.packet : {};
  const selected = payload.selected && typeof payload.selected === 'object' ? payload.selected : null;
  const evidenceSufficiency = normalizeText(payload.evidenceSufficiency).toLowerCase();
  const contradictionFlags = [];

  if (!selected) {
    return {
      selected: {
        id: 'clarify_candidate',
        kind: 'clarify_candidate',
        replyText: buildClarifyReply(packet),
        domainIntent: packet.normalizedConversationIntent || 'general',
        atoms: {}
      },
      verificationOutcome: 'clarify',
      contradictionFlags: ['missing_candidate']
    };
  }

  let replyText = normalizeText(selected.replyText);
  let verificationOutcome = 'passed';

  if (evidenceSufficiency === 'refuse') {
    replyText = 'この内容はこの場で断定せず、公式窓口や運用担当と一緒に確認したほうが安全です。必要なら確認観点を3つまで整理します。';
    verificationOutcome = 'refuse';
    contradictionFlags.push('unsupported_named_claim');
  } else if (evidenceSufficiency === 'clarify') {
    replyText = buildClarifyReply(packet);
    verificationOutcome = 'clarify';
    contradictionFlags.push('insufficient_evidence');
  } else if (evidenceSufficiency === 'answer_with_hedge') {
    replyText = addHedge(replyText);
    verificationOutcome = 'hedged';
    contradictionFlags.push('weak_evidence');
  }

  if (packet.normalizedConversationIntent && packet.normalizedConversationIntent !== 'general') {
    const candidateIntent = normalizeText(selected.domainIntent).toLowerCase();
    if (candidateIntent && candidateIntent !== packet.normalizedConversationIntent) {
      contradictionFlags.push('domain_alignment_weak');
    }
  }

  const skipCommitmentCheck = selected.kind === 'domain_concierge_candidate' && selected.conciseModeApplied === true;
  if (!skipCommitmentCheck && Array.isArray(packet.recentAssistantCommitments) && packet.recentAssistantCommitments.length > 0) {
    const mentionsPriorFocus = packet.recentAssistantCommitments.some((item) => {
      const token = normalizeText(item).replace(/[_.]/g, ' ');
      return token && replyText.includes(token.slice(0, 4));
    });
    if (!mentionsPriorFocus && selected.kind !== 'casual_candidate') {
      contradictionFlags.push('recent_commitment_unreferenced');
    }
  }

  return {
    selected: Object.assign({}, selected, { replyText }),
    verificationOutcome,
    contradictionFlags: contradictionFlags.slice(0, 8)
  };
}

module.exports = {
  verifyCandidate
};
