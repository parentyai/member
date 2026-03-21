'use strict';

const crypto = require('crypto');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function countActionLines(text) {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^・/.test(line) || /^[-*]\s+/.test(line))
    .length;
}

function normalizeTemplateLine(line) {
  const text = normalizeText(line);
  if (!text) return '';
  if (/^まずは次の一手です/.test(text)) return 'NEXT_STEP_INTRO';
  if (/^状況を整理しながら進め(?:ましょう|ます)/.test(text)) return 'SITUATION_INTRO';
  if (/詰まりやすい|注意|リスク|気をつけ|ボトルネック/.test(text)) return 'PITFALL_LINE';
  if ((/[?？]$/.test(text) || /教えてください/.test(text)) && !/^・/.test(text)) return 'QUESTION_LINE';
  if (/^・/.test(text) || /^[-*]\s+/.test(text)) return 'ACTION_LINE';
  return text;
}

function normalizeForReplyTemplateFingerprint(value) {
  const text = normalizeText(value);
  if (!text) return '';
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/https?:\/\/\S+/gi, ' URL ')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, ' EMAIL ')
    .replace(/\b[A-Z]{2,}[-_ ]?\d{2,}\b/g, ' ID ')
    .replace(/\b\d{1,4}(?:[\/:-]\d{1,4})+\b/g, ' DATE ')
    .replace(/\b\d+\b/g, ' NUM ')
    .replace(/[“”"「」『』]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
  if (!normalized) return '';
  return normalized
    .split('\n')
    .map((line) => normalizeTemplateLine(line))
    .filter(Boolean)
    .join('\n')
    .slice(0, 480);
}

function buildReplyTemplateFingerprint(value) {
  const seed = normalizeForReplyTemplateFingerprint(value);
  if (!seed) return null;
  return `rtf_${crypto.createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 16)}`;
}

function classifyReplyTemplateKind(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const text = normalizeText(payload.replyText || payload.text);
  const candidateKind = normalizeText(payload.candidateKind).toLowerCase();
  const readinessDecision = normalizeText(payload.readinessDecision).toLowerCase();
  const conciseModeApplied = payload.conciseModeApplied === true || payload.conciseMode === true;
  const actionCount = countActionLines(text);

  if (!text) return null;
  if (readinessDecision === 'refuse' || /^この内容は安全に断定できない/.test(text)) return 'refuse_template';
  if (/^状況を整理しながら進め(?:ましょう|ます)/.test(text) || /^まずは次の一手です/.test(text) || text.includes('\nまずは次の一手です。')) {
    return 'generic_fallback';
  }
  if (candidateKind === 'grounded_candidate' || candidateKind === 'composed_concierge_candidate') {
    return 'grounded_answer_template';
  }
  if (candidateKind === 'clarify_candidate' || readinessDecision === 'clarify') {
    return 'clarify_template';
  }
  if (candidateKind === 'casual_candidate') return 'casual_template';
  if (candidateKind === 'domain_concierge_candidate') return 'domain_concierge_template';
  if (conciseModeApplied && actionCount <= 1) return 'domain_concierge_template';
  if (actionCount > 0) return 'domain_concierge_template';
  if (/[?？]$/.test(text) || /教えてください/.test(text)) return 'clarify_template';
  return 'casual_template';
}

function resolveGenericFallbackSlice(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText).toLowerCase();
  const domainIntent = normalizeText(payload.domainIntent || payload.normalizedConversationIntent).toLowerCase();
  const followupIntent = normalizeText(payload.followupIntent).toLowerCase();
  const routerReason = normalizeText(payload.routerReason).toLowerCase();
  const priorContextUsed = payload.priorContextUsed === true;
  const followupResolvedFromHistory = payload.followupResolvedFromHistory === true;
  const continuationReason = normalizeText(payload.continuationReason).toLowerCase();
  const cityExplicit = /(ニューヨーク|new york|ロサンゼルス|los angeles|サンフランシスコ|san francisco|シアトル|seattle|ボストン|boston|シカゴ|chicago|オースティン|austin|サンディエゴ|san diego|ワシントン|washington|街|都市|city|州|エリア)/.test(messageText);

  const followupContextActive = priorContextUsed || followupResolvedFromHistory || continuationReason === 'history_followup_carry';
  if (followupIntent && followupContextActive) {
    return 'followup';
  }
  if (followupContextActive) {
    return 'followup';
  }
  if (cityExplicit) {
    return 'city';
  }
  if (domainIntent === 'housing' || /(住まい|住居|家賃|賃貸|物件|アパート|住宅|部屋探し)/.test(messageText)) {
    return 'housing';
  }
  if (/(引っ越|引越|生活)/.test(messageText)) {
    return 'city';
  }
  if (routerReason === 'question_pattern'
    || /(どうすれば|どうしたら|何から|何をすれば|相談したい|困ってる|進めたい|どのくらい.*お金|だいたいどのくらい.*お金)/.test(messageText)) {
    return 'broad';
  }
  return 'other';
}

module.exports = {
  buildReplyTemplateFingerprint,
  classifyReplyTemplateKind,
  resolveGenericFallbackSlice,
  normalizeForReplyTemplateFingerprint
};
