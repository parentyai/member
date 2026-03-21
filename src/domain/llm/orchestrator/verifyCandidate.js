'use strict';

const { buildEchoContinuationFromSource } = require('../../../usecases/assistant/generatePaidDomainConciergeReply');

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

const INTERNAL_LABEL_PATTERN = /\b(general|domain_concierge|clarify_candidate|continuation_candidate|structured_answer_candidate|request_shape_[a-z_]+|contextual_domain_resume|followup_intent)\b/i;

function countLines(text) {
  return normalizeText(text).split('\n').map((line) => line.trim()).filter(Boolean).length;
}

function countSentences(text) {
  const matches = normalizeText(text).match(/[。！？!?]/g);
  return Array.isArray(matches) ? matches.length : 0;
}

function containsQuestionBack(text) {
  return /[?？]$/.test(normalizeText(text))
    || /(教えてください|教えてもらえますか|聞かせてください|決めましょうか)/.test(normalizeText(text));
}

function containsReasonCue(text) {
  return /(理由|からです|から|なぜなら)/.test(normalizeText(text));
}

function containsOrderCue(text) {
  return /(順番|先に|次に|今日|今週|今月|優先)/.test(normalizeText(text));
}

function containsPunctuationAnomaly(text) {
  return /(\.\.|。。|？？|！！|。？|？。|！。|。！)/.test(normalizeText(text));
}

function hasDomainWord(text, domainIntent) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (domainIntent === 'housing') return /(住まい|住居|住宅|物件|賃貸|内見|エリア)/.test(normalized);
  if (domainIntent === 'school') return /(学校|学区|入学|転校|対象校)/.test(normalized);
  if (domainIntent === 'ssn') return /(SSN|ソーシャルセキュリティ)/i.test(normalized);
  if (domainIntent === 'banking') return /(銀行|口座|支店)/.test(normalized);
  return true;
}

function extractFirstLine(text) {
  return normalizeText(text).split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';
}

function ensureSentence(text) {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  if (/[。！？!?]$/.test(normalized)) return normalized;
  return `${normalized}。`;
}

function buildMessageTemplateFallback(sourceReplyText, domainIntent) {
  const firstLine = extractFirstLine(sourceReplyText);
  if (/事前予約が必要かどうか/.test(firstLine)) {
    return 'もし差し支えなければ、事前予約が必要かどうか教えていただけると助かります。';
  }
  if (/今日は最優先の1件の期限だけ確認して/.test(firstLine)) {
    return '今日は最優先の1件の期限だけ確認して、必要書類か予約要否のどちらを先に見るか決めてみます。';
  }
  if (/制度や期限|公式情報/.test(normalizeText(sourceReplyText))) {
    return '制度や期限が変わりそうなところだけ、先に公式情報を見ておきます。';
  }
  if (/住まい|入居|エリア/.test(firstLine) || domainIntent === 'housing') {
    return '住まい優先で進めたいので、まずは希望エリアと入居時期を整理してみます。';
  }
  if (/学校|学区|対象校/.test(firstLine) || domainIntent === 'school') {
    return '学校優先で進めたいので、まずは学区と対象校の条件を確認してみます。';
  }
  if (/SSN|ソーシャルセキュリティ/.test(firstLine) || domainIntent === 'ssn') {
    return 'まずはSSNの必要書類を整理して、窓口の条件を確認してみます。';
  }
  return '今進める順番を整理したいので、最初に何を優先すべきか教えてもらえると助かります。';
}

function buildConstrainedFallbackReply(packet) {
  const payload = packet && typeof packet === 'object' ? packet : {};
  const requestShape = normalizeText(payload.requestShape).toLowerCase();
  const outputForm = normalizeText(payload.outputForm).toLowerCase();
  const primaryDomainIntent = normalizeText(payload.primaryDomainIntent || payload.normalizedConversationIntent).toLowerCase() || 'general';
  const sourceReplyText = normalizeText(payload.sourceReplyText || (payload.requestContract && payload.requestContract.sourceReplyText));
  if (requestShape === 'followup_continue' && payload.echoOfPriorAssistant === true) {
    const sourceAwareContinuation = buildEchoContinuationFromSource(sourceReplyText);
    if (Array.isArray(sourceAwareContinuation) && sourceAwareContinuation.length > 0) {
      return ensureSentence(sourceAwareContinuation[0]);
    }
  }
  if (requestShape === 'message_template' || outputForm === 'message_only' || outputForm === 'polite_template') {
    return buildMessageTemplateFallback(sourceReplyText, primaryDomainIntent);
  }
  if (requestShape === 'rewrite' && outputForm === 'non_dogmatic') {
    const line = extractFirstLine(sourceReplyText);
    if (/事前予約が必要かどうか/.test(line)) {
      return 'もし差し支えなければ、事前予約が必要かどうか教えていただけると助かります。';
    }
    if (/制度|期限|必要書類|費用/.test(line)) {
      return '制度や期限が変わりそうな話なら、まず公式情報を見ておくと安心かもしれません。';
    }
    return 'もしよければ、まずは優先するものを1つだけ決める形で進めると無理が少なそうです。';
  }
  if (requestShape === 'rewrite' && outputForm === 'two_sentences') {
    if (/制度|期限|必要書類|費用/.test(sourceReplyText)) {
      return '制度や期限が変わる話は、まず公式情報を見ておくと安心です。\nそのあとで、どこを確認するか一緒に絞っていけます。';
    }
    return 'まずは、いちばん気になっている手続きを1つに絞るところからで大丈夫です。\nそこが決まれば、次に見ることを一緒に整理できます。';
  }
  if (requestShape === 'rewrite') {
    return ensureSentence(buildMessageTemplateFallback(sourceReplyText, primaryDomainIntent).replace(/教えてもらえると助かります。?$/, '一緒に整理していきましょう'));
  }
  if (requestShape === 'correction' && /(housing|school)/.test(primaryDomainIntent)) {
    if (primaryDomainIntent === 'housing') {
      return '了解です。住まい優先で見るなら、希望エリアと入居時期を先に固定しましょう。';
    }
    return '了解です。学校優先で見るなら、学区と対象校の条件を先に確認しましょう。';
  }
  const baseLineByDomain = {
    housing: 'まずは住まいの優先条件を1つだけ決める形で進めると無理が少ないです。',
    school: 'まずは学校手続きの対象校か学区を1つだけ決める形で進めると整理しやすいです。',
    ssn: 'まずはSSN手続きの必要書類を1つの一覧にまとめる形で進めると整理しやすいです。',
    banking: 'まずは口座開設で確認したい条件を1つだけ決める形で進めると進めやすいです。',
    general: 'まずは優先する1件だけ決める形で進めると、無理が少なそうです。'
  };
  const line = baseLineByDomain[primaryDomainIntent] || baseLineByDomain.general;
  if (outputForm === 'one_line' || outputForm === 'message_only' || outputForm === 'polite_template' || outputForm === 'non_dogmatic') {
    return line;
  }
  if (outputForm === 'two_sentences') {
    return `${line}\nそのあとで、必要書類か予約要否のどちらを見るか選べば十分です。`;
  }
  return line;
}

function collectViolationCodes(packet, selected, replyText) {
  const payload = packet && typeof packet === 'object' ? packet : {};
  const candidate = selected && typeof selected === 'object' ? selected : {};
  const requestShape = normalizeText(payload.requestShape).toLowerCase();
  const outputForm = normalizeText(payload.outputForm).toLowerCase();
  const detailObligations = Array.isArray(payload.detailObligations) ? payload.detailObligations : [];
  const domainSignals = Array.isArray(payload.domainSignals) ? payload.domainSignals : [];
  const recentHints = Array.isArray(payload.recentResponseHints) ? payload.recentResponseHints : [];
  const normalizedReply = normalizeText(replyText);
  const violationCodes = [];

  if (!normalizedReply) violationCodes.push('detail_drop');
  if (INTERNAL_LABEL_PATTERN.test(normalizedReply)) violationCodes.push('internal_label_leak');
  if (containsPunctuationAnomaly(normalizedReply)) violationCodes.push('punctuation_anomaly');
  if (/(地域によって違う|地域差がある)/.test(normalizeText(payload.messageText))
    && /(地域を設定|地域設定|地域を教えてください|設定しました)/.test(normalizedReply)) {
    violationCodes.push('command_boundary_collision');
  }
  if (payload.echoOfPriorAssistant === true) {
    const echoed = recentHints.some((hint) => similarityScore(normalizedReply, hint) >= 0.86);
    if (echoed) violationCodes.push('parrot_echo');
  }
  if (outputForm === 'one_line' && countLines(normalizedReply) !== 1) violationCodes.push('format_noncompliance');
  if (outputForm === 'two_sentences' && countSentences(normalizedReply) !== 2) violationCodes.push('format_noncompliance');
  if ((outputForm === 'message_only' || detailObligations.includes('message_only')) && countLines(normalizedReply) !== 1) {
    violationCodes.push('format_noncompliance');
  }
  if (outputForm === 'non_dogmatic' && !/(もしよければ|よさそう|無理が少ない|かもしれません)/.test(normalizedReply)) {
    violationCodes.push('format_noncompliance');
  }
  if (
    payload.answerability === 'answer_now'
    && (
      ['rewrite', 'message_template', 'compare', 'criteria', 'correction', 'summarize'].includes(requestShape)
      || detailObligations.includes('avoid_question_back')
    )
    && containsQuestionBack(normalizedReply)
  ) {
    violationCodes.push('followup_overask');
  }
  if (detailObligations.includes('preserve_both_domains')) {
    const allDomainsPresent = domainSignals.every((domain) => hasDomainWord(normalizedReply, domain));
    if (!allDomainsPresent) violationCodes.push('mixed_domain_collapse');
  }
  const correctionRequiresDomainSurface = requestShape !== 'message_template'
    && requestShape !== 'rewrite'
    && outputForm !== 'message_only'
    && outputForm !== 'polite_template'
    && outputForm !== 'non_dogmatic';
  if (detailObligations.includes('respect_correction') && correctionRequiresDomainSurface) {
    const primaryDomainIntent = normalizeText(payload.primaryDomainIntent || payload.normalizedConversationIntent).toLowerCase();
    if (primaryDomainIntent && primaryDomainIntent !== 'general' && !hasDomainWord(normalizedReply, primaryDomainIntent)) {
      violationCodes.push('correction_ignored');
    }
  }
  if (detailObligations.includes('preserve_reason') && !containsReasonCue(normalizedReply)) {
    violationCodes.push('detail_drop');
  }
  if (detailObligations.includes('preserve_order_axis') && !containsOrderCue(normalizedReply)) {
    violationCodes.push('detail_drop');
  }
  if (candidate.kind === 'clarify_candidate' && payload.answerability === 'answer_now') {
    violationCodes.push('followup_overask');
  }
  return Array.from(new Set(violationCodes));
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
    const fallbackReplyText = buildConstrainedFallbackReply(packet);
    return {
      selected: {
        id: 'domain_concierge_candidate',
        kind: 'domain_concierge_candidate',
        replyText: payload.evidenceSufficiency === 'clarify' ? buildClarifyReply(packet) : fallbackReplyText,
        domainIntent: packet.normalizedConversationIntent || 'general',
        preserveReplyText: payload.evidenceSufficiency !== 'clarify',
        directAnswerCandidate: payload.evidenceSufficiency !== 'clarify',
        atoms: {
          situationLine: payload.evidenceSufficiency === 'clarify' ? buildClarifyReply(packet) : fallbackReplyText,
          nextActions: [],
          pitfall: '',
          followupQuestion: ''
        }
      },
      verificationOutcome: payload.evidenceSufficiency === 'clarify' ? 'clarify' : 'passed',
      contradictionFlags: ['missing_candidate'],
      violationCodes: [],
      blockingViolationCodes: []
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

  const violationCodes = collectViolationCodes(packet, selected, replyText);
  const blockingViolationCodes = violationCodes.slice();
  const constrainedFallbackReply = buildConstrainedFallbackReply(packet);

  return {
    selected: Object.assign({}, selected, {
      replyText: blockingViolationCodes.length > 0 ? constrainedFallbackReply : replyText,
      preserveReplyText: selected.preserveReplyText === true || blockingViolationCodes.length > 0
    }),
    verificationOutcome,
    contradictionFlags: contradictionFlags.slice(0, 8),
    violationCodes,
    blockingViolationCodes
  };
}

module.exports = {
  verifyCandidate
};
