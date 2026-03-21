'use strict';

const { detectConversationIntentHits, DOMAIN_INTENTS } = require('../router/normalizeConversationIntent');

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
  if (a.includes(b) || b.includes(a)) return 0.92;
  let overlap = 0;
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) {
    if (a[i] === b[i]) overlap += 1;
  }
  return overlap / Math.max(a.length, b.length);
}

function uniqueList(values, limit) {
  const rows = Array.isArray(values) ? values : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 8;
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).toLowerCase();
    if (!normalized || out.includes(normalized) || out.length >= max) return;
    out.push(normalized);
  });
  return out;
}

function normalizeReplyRow(row) {
  const payload = row && typeof row === 'object' ? row : {};
  return {
    replyText: normalizeText(payload.replyText),
    committedFollowupQuestion: normalizeText(payload.committedFollowupQuestion),
    domainIntent: normalizeText(payload.domainIntent).toLowerCase(),
    followupIntent: normalizeText(payload.followupIntent).toLowerCase(),
    requestShape: normalizeText(payload.requestShape).toLowerCase(),
    outputForm: normalizeText(payload.outputForm).toLowerCase()
  };
}

function isEchoCandidateLine(value) {
  const text = normalizeText(value);
  return text.length >= 16;
}

function extractReplyCandidates(row) {
  const normalized = normalizeReplyRow(row);
  const values = [normalized.replyText, normalized.committedFollowupQuestion];
  const out = [];
  values.forEach((value) => {
    const text = normalizeText(value);
    if (!text) return;
    if (!out.includes(text)) out.push(text);
    text
      .split('\n')
      .map((line) => normalizeText(line))
      .filter((line) => isEchoCandidateLine(line))
      .forEach((line) => {
        if (!out.includes(line)) out.push(line);
      });
  });
  return out;
}

function detectExplicitDomainSignals(messageText) {
  const hits = detectConversationIntentHits(messageText);
  return DOMAIN_INTENTS.filter((key) => hits[key] === true);
}

function resolveCorrectionPreferredDomain(messageText, explicitDomainSignals) {
  const normalized = normalizeText(messageText);
  const signals = uniqueList(explicitDomainSignals, 4);
  if (!signals.length) return null;
  if (signals.length === 1) return signals[0];
  const correctionOverrides = [
    {
      domain: 'housing',
      pattern: /((学校|学区).*(じゃなくて|ではなく|より).*(住まい|住居|住宅|部屋|家探し|引っ越し))|(住まい優先|住居優先|住宅優先|引っ越し優先)/i
    },
    {
      domain: 'school',
      pattern: /((住まい|住居|住宅|部屋|家探し|引っ越し).*(じゃなくて|ではなく|より).*(学校|学区|入学|転校))|(学校優先|学区優先)/i
    },
    {
      domain: 'ssn',
      pattern: /(((銀行|口座).*(じゃなくて|ではなく|より).*(ssn|ソーシャルセキュリティ))|(ssn優先))/i
    },
    {
      domain: 'banking',
      pattern: /(((ssn|ソーシャルセキュリティ).*(じゃなくて|ではなく|より).*(銀行|口座))|((銀行|口座)優先))/i
    }
  ];
  const matched = correctionOverrides.find((item) => item.pattern.test(normalized));
  if (matched && signals.includes(matched.domain)) return matched.domain;
  return signals[0];
}

function detectOutputForm(messageText) {
  const text = normalizeText(messageText);
  if (!text) return 'default';
  if (/(相手に送る文面だけ|文面だけ|返信文だけ|送る文面|メッセージだけ)/i.test(text)) return 'message_only';
  if (/(失礼なく|丁寧に|やわらかい敬語|失礼のない)/i.test(text)) return 'polite_template';
  if (/(断定しすぎない|断定せずに|言い切らない|やわらかく提案)/i.test(text)) return 'non_dogmatic';
  if (/(1行にして|一行にして|1行だけ|一行だけ|一文にして|一文だけ)/i.test(text)) return 'one_line';
  if (/(2文にして|二文にして|2文だけ|二文だけ)/i.test(text)) return 'two_sentences';
  return 'default';
}

function detectRequestShape(messageText, options) {
  const payload = options && typeof options === 'object' ? options : {};
  const text = normalizeText(messageText);
  if (!text) return 'answer';
  if (/(相手に送る文面だけ|文面だけ|返信文だけ|家族に送れる|一文にして|短文を1つ作って|短文だけ|文章だけ|文面を作って)/i.test(text)) {
    return 'message_template';
  }
  if (/(言い換える|言い方に直して|断定しすぎない|断定せずに|人に話す感じ|2文にして|二文にして|事務的すぎない|やさしく|やわらかく|少し硬い)/i.test(text)) {
    return 'rewrite';
  }
  if (payload.recoverySignal === true || /(それは違う|それも違う|違う、|ちがう、|そうじゃない|それじゃない|ではなく|じゃなくて|考え直して|今度は逆|訂正|修正)/i.test(text)) {
    return 'correction';
  }
  if (/(無料プラン.*有料プラン|有料プラン.*無料プラン|どっち|どちら|比較|違い|理由つき|理由付き)/i.test(text)) {
    return 'compare';
  }
  if (/(判断基準だけ|何を確認すべきかだけ|確認すべき場面|基準だけ|criteria)/i.test(text)) {
    return 'criteria';
  }
  if (/(今日・今週・今月|今日.*今週.*今月|今週.*今月|1行にして|一行にして|3つだけ|三つだけ|2つだけ|二つだけ|2点|二点|短く並べて|要点だけ|短くして|不安が強い.*(1つだけ|一つだけ|絞って))/i.test(text)) {
    return 'summarize';
  }
  if (
    /(地域によって違う|地域差がある|最新情報|法的|可否|合法|違法|緊急|今いる地域|注意情報)/i.test(text)
    && payload.highRiskIntent === true
  ) {
    return 'high_risk_clarify';
  }
  if (
    payload.contextResumeCue === true
    || /(それなら|それで|じゃあ|さっきの説明|ここまでを踏まえて|前提だと|それなら最初の|今の返答|今の説明)/i.test(text)
  ) {
    return 'followup_continue';
  }
  if (payload.echoOfPriorAssistant === true) return 'followup_continue';
  return 'answer';
}

function detectDetailObligations(messageText, options) {
  const payload = options && typeof options === 'object' ? options : {};
  const text = normalizeText(messageText);
  const obligations = [];
  if (
    (Array.isArray(payload.domainSignals) ? payload.domainSignals : []).length >= 2
    && payload.requestShape !== 'correction'
  ) {
    obligations.push('preserve_both_domains');
  }
  if (payload.requestShape === 'correction' || payload.recoverySignal === true) obligations.push('respect_correction');
  if (/(理由つき|理由付き|理由|なぜ|どうして|because)/i.test(text)) obligations.push('preserve_reason');
  if (/(順番|先に|後に|どっち|どちら|優先|今日・今週・今月|今日.*今週.*今月)/i.test(text)) obligations.push('preserve_order_axis');
  if (payload.outputForm === 'message_only') obligations.push('message_only');
  if (payload.outputForm === 'polite_template') obligations.push('polite_template');
  if (payload.outputForm === 'non_dogmatic') obligations.push('non_dogmatic');
  if (payload.outputForm === 'one_line') obligations.push('one_line_only');
  if (payload.outputForm === 'two_sentences') obligations.push('two_sentences_only');
  if (payload.requestShape === 'message_template' || payload.requestShape === 'rewrite' || payload.requestShape === 'summarize') {
    obligations.push('avoid_question_back');
  }
  if (payload.echoOfPriorAssistant === true) obligations.push('avoid_question_back');
  return uniqueList(obligations, 10);
}

function detectAnswerability(messageText, options) {
  const payload = options && typeof options === 'object' ? options : {};
  const text = normalizeText(messageText);
  const requestShape = payload.requestShape || 'answer';
  if (requestShape === 'high_risk_clarify') return 'high_risk_clarify';
  if (['rewrite', 'summarize', 'message_template', 'compare', 'criteria', 'correction'].includes(requestShape)) {
    return 'answer_now';
  }
  if (payload.echoOfPriorAssistant === true || payload.contextResumeCue === true || payload.recoverySignal === true) {
    return 'answer_now';
  }
  if (payload.lowInformationMessage === true && payload.currentTurnHasExplicitDomain !== true && text.length <= 8) {
    return 'needs_clarify';
  }
  return 'answer_now';
}

function detectEchoOfPriorAssistant(messageText, recentResponseHints) {
  const text = normalizeText(messageText);
  const hints = Array.isArray(recentResponseHints) ? recentResponseHints : [];
  if (!text || !hints.length) return false;
  return hints.slice(0, 2).some((hint) => similarityScore(text, hint) >= 0.86);
}

function resolveMatchedPriorReply(messageText, recentReplyRows) {
  const text = normalizeText(messageText);
  const rows = Array.isArray(recentReplyRows) ? recentReplyRows : [];
  if (!text || !rows.length) return null;
  let best = null;
  rows.slice(0, 6).forEach((row, index) => {
    const normalized = normalizeReplyRow(row);
    const similarity = extractReplyCandidates(normalized)
      .reduce((max, candidateText) => Math.max(max, similarityScore(text, candidateText)), 0);
    if (similarity < 0.86) return;
    if (!best || similarity > best.similarity || (similarity === best.similarity && index < best.index)) {
      best = {
        index,
        similarity,
        row: normalized
      };
    }
  });
  return best ? best.row : null;
}

function resolveSourceReplyText(requestShape, matchedPriorReply, latestAssistantReplyText) {
  if (matchedPriorReply && matchedPriorReply.replyText) return matchedPriorReply.replyText;
  if (['rewrite', 'message_template', 'summarize', 'followup_continue', 'correction'].includes(requestShape)) {
    return normalizeText(latestAssistantReplyText);
  }
  return '';
}

function buildRequestContract(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const explicitDomainSignals = detectExplicitDomainSignals(messageText);
  const fallbackDomain = normalizeText(payload.fallbackDomain).toLowerCase();
  const recentResponseHints = Array.isArray(payload.recentResponseHints) ? payload.recentResponseHints : [];
  const matchedPriorReply = resolveMatchedPriorReply(messageText, payload.recentReplyRows);
  const echoOfPriorAssistant = Boolean(matchedPriorReply) || detectEchoOfPriorAssistant(messageText, recentResponseHints);
  const currentTurnHasExplicitDomain = explicitDomainSignals.length > 0;
  const outputForm = detectOutputForm(messageText);
  const highRiskIntent = payload.highRiskIntent === true;
  const requestShape = detectRequestShape(messageText, {
    recoverySignal: payload.recoverySignal === true,
    contextResumeCue: payload.contextResumeCue === true,
    echoOfPriorAssistant,
    highRiskIntent
  });
  const sourceReplyText = resolveSourceReplyText(requestShape, matchedPriorReply, payload.latestAssistantReplyText);
  const sourceDomainIntent = normalizeText(
    (matchedPriorReply && matchedPriorReply.domainIntent) || payload.latestAssistantDomainIntent
  ).toLowerCase();
  const sourceFollowupIntent = normalizeText(
    (matchedPriorReply && matchedPriorReply.followupIntent) || payload.latestAssistantFollowupIntent
  ).toLowerCase();
  const echoGeneralMixedContinuation = requestShape === 'followup_continue'
    && echoOfPriorAssistant === true
    && sourceDomainIntent === 'general'
    && explicitDomainSignals.length >= 2;
  const primaryFromCorrection = requestShape === 'correction'
    ? resolveCorrectionPreferredDomain(messageText, explicitDomainSignals)
    : null;
  const preserveSourceDomain = ['rewrite', 'message_template', 'correction', 'followup_continue'].includes(requestShape);
  const utilityGeneralOverride = explicitDomainSignals.length === 0
    && (requestShape === 'criteria' || requestShape === 'summarize');
  const primaryDomainIntent = primaryFromCorrection
    || (echoGeneralMixedContinuation ? 'general' : null)
    || explicitDomainSignals[0]
    || (preserveSourceDomain ? (sourceDomainIntent || null) : null)
    || (utilityGeneralOverride ? 'general' : null)
    || (fallbackDomain && fallbackDomain !== 'general' ? fallbackDomain : 'general');
  const domainSignals = uniqueList(
    explicitDomainSignals.length > 0 ? explicitDomainSignals : (primaryDomainIntent !== 'general' ? [primaryDomainIntent] : []),
    4
  );
  const detailObligations = detectDetailObligations(messageText, {
    domainSignals,
    requestShape,
    outputForm,
    recoverySignal: payload.recoverySignal === true,
    echoOfPriorAssistant
  });
  const answerability = detectAnswerability(messageText, {
    requestShape,
    lowInformationMessage: payload.lowInformationMessage === true,
    currentTurnHasExplicitDomain,
    contextResumeCue: payload.contextResumeCue === true,
    recoverySignal: payload.recoverySignal === true,
    echoOfPriorAssistant
  });
  return {
    primaryDomainIntent,
    domainSignals,
    requestShape,
    outputForm,
    detailObligations,
    answerability,
    echoOfPriorAssistant,
    currentTurnHasExplicitDomain,
    fallbackDomainUsed: currentTurnHasExplicitDomain !== true && primaryDomainIntent !== 'general',
    sourceReplyText,
    sourceDomainIntent: sourceDomainIntent || null,
    sourceFollowupIntent: sourceFollowupIntent || null,
    sourceMatchedFromHistory: Boolean(matchedPriorReply)
  };
}

module.exports = {
  buildRequestContract
};
