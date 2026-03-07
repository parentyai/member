'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildClarifyReply(packet) {
  const intent = normalizeText(packet && packet.normalizedConversationIntent).toLowerCase();
  if (intent && intent !== 'general') {
    return '状況は把握しました。まず優先したい手続きと期限を1つずつ教えてください。そこから次の一手を絞ります。';
  }
  return '対象を絞って案内したいので、いま一番気になっている手続きと期限を1つずつ教えてください。';
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

  if (Array.isArray(packet.recentAssistantCommitments) && packet.recentAssistantCommitments.length > 0) {
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
