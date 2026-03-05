'use strict';

const { searchFaqFromKb } = require('../faq/searchFaqFromKb');
const { searchCityPackCandidates } = require('./retrieval/searchCityPackCandidates');
const { sanitizeRetrievalCandidates } = require('./retrieval/sanitizeRetrievalCandidates');
const { selectConversationStyle } = require('../../domain/llm/conversation/styleRouter');
const { composeConversationDraftFromSignals } = require('../../domain/llm/conversation/conversationComposer');
const { humanizeConversationMessage } = require('../../domain/llm/conversation/styleHumanizer');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function trimForLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 4500 ? `${text.slice(0, 4500)}...` : text;
}

function resolveFreeStyleDecision(question, topic) {
  const style = selectConversationStyle({
    topic: normalizeText(topic) || 'general',
    question: normalizeText(question),
    userTier: 'free',
    journeyPhase: 'pre',
    messageLength: normalizeText(question).length,
    timeOfDay: new Date().getHours(),
    urgency: ''
  });
  return Object.assign({}, style, {
    maxActions: 2
  });
}

function buildEmptyReply(question) {
  const title = normalizeText(question) || 'ご質問';
  const draftPacket = composeConversationDraftFromSignals({
    summary: `${title} に一致する情報が見つかりませんでした。`,
    nextActions: [
      'キーワードを短くして再検索する',
      '都市名/期限/手続き名を追加して再送する'
    ],
    pitfall: '対象手続きと期限が曖昧なまま再検索すると候補が広がります。',
    question: '都市名・期限・手続き名を1つずつ教えてください。',
    state: 'CLARIFY',
    move: 'Narrow'
  });
  const styleDecision = resolveFreeStyleDecision(question, 'other');
  const humanized = humanizeConversationMessage({ draftPacket, styleDecision });
  return [humanized.text, '不明点は運用窓口へお問い合わせください。'].join('\n\n').trim();
}

function buildCitationSection(faqCandidates, cityPackCandidates) {
  const lines = [];
  if (faqCandidates.length) {
    lines.push('FAQ候補');
    faqCandidates.slice(0, 3).forEach((item, index) => {
      const score = Number.isFinite(Number(item.searchScore)) ? Number(item.searchScore) : 0;
      lines.push(`${index + 1}. ${item.title || '-'} (score=${score})`);
      lines.push(`根拠キー: ${item.articleId}`);
    });
  }
  if (cityPackCandidates.length) {
    if (lines.length) lines.push('');
    lines.push('CityPack候補');
    cityPackCandidates.slice(0, 2).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title || '-'} (${item.reason || 'city_pack_match'})`);
      lines.push(`根拠キー: ${item.sourceId}`);
    });
  }
  return lines.join('\n').trim();
}

function buildRankedReply(question, faqCandidates, cityPackCandidates) {
  const title = normalizeText(question) || '検索結果';
  const nextActions = [];
  faqCandidates.slice(0, 2).forEach((item) => {
    nextActions.push(`FAQ候補を確認する（${item.articleId}）`);
  });
  cityPackCandidates.slice(0, 1).forEach((item) => {
    nextActions.push(`CityPack候補を確認する（${item.sourceId}）`);
  });
  if (!nextActions.length) {
    nextActions.push('キーワードを変えて再検索する');
  }
  const draftPacket = composeConversationDraftFromSignals({
    summary: `${title} の関連情報です。`,
    nextActions,
    pitfall: '候補を同時に進めると手続きが分散しやすくなります。',
    question: '',
    state: 'PLAN',
    move: 'Offer'
  });
  const styleDecision = resolveFreeStyleDecision(question, faqCandidates.length ? 'visa' : 'other');
  const humanized = humanizeConversationMessage({ draftPacket, styleDecision });
  const citationSection = buildCitationSection(faqCandidates, cityPackCandidates);
  return [humanized.text, citationSection, '必要なら「抜け漏れチェック」「次アクション」を送ってPro支援を試せます。']
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

async function generateFreeRetrievalReply(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const question = normalizeText(payload.question);
  const locale = normalizeText(payload.locale) || 'ja';
  const lineUserId = normalizeText(payload.lineUserId);

  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const faqSearch = resolvedDeps.searchFaqFromKb || searchFaqFromKb;
  const cityPackSearch = resolvedDeps.searchCityPackCandidates || searchCityPackCandidates;

  const [faq, cityPack] = await Promise.all([
    faqSearch({ question, locale, limit: 3, intent: 'faq_search' }).catch(() => ({ ok: true, mode: 'empty', candidates: [], citations: [] })),
    cityPackSearch({ lineUserId, locale, limit: 3 }).catch(() => ({ ok: true, mode: 'empty', candidates: [] }))
  ]);

  const faqCandidates = Array.isArray(faq && faq.candidates) ? faq.candidates : [];
  const cityPackCandidates = Array.isArray(cityPack && cityPack.candidates) ? cityPack.candidates : [];
  const sanitized = sanitizeRetrievalCandidates([faqCandidates, cityPackCandidates]);
  const safeFaqCandidates = Array.isArray(sanitized.candidatesByGroup && sanitized.candidatesByGroup[0])
    ? sanitized.candidatesByGroup[0]
    : [];
  const safeCityPackCandidates = Array.isArray(sanitized.candidatesByGroup && sanitized.candidatesByGroup[1])
    ? sanitized.candidatesByGroup[1]
    : [];
  const injectionFindings = sanitized.injectionFindings === true;
  const blockedReasons = Array.isArray(sanitized.blockedReasons) ? sanitized.blockedReasons : [];
  const citations = [];

  safeFaqCandidates.forEach((row) => {
    const key = normalizeText(row && row.articleId);
    if (key && !citations.includes(key)) citations.push(key);
  });
  safeCityPackCandidates.forEach((row) => {
    const key = normalizeText(row && row.sourceId);
    if (key && !citations.includes(key)) citations.push(key);
  });

  const mode = safeFaqCandidates.length || safeCityPackCandidates.length ? 'ranked' : 'empty';
  const replyText = mode === 'ranked'
    ? buildRankedReply(question, safeFaqCandidates, safeCityPackCandidates)
    : buildEmptyReply(question);

  return {
    ok: true,
    mode,
    citations,
    faqCandidates: safeFaqCandidates,
    cityPackCandidates: safeCityPackCandidates,
    injectionFindings,
    blockedReasons,
    replyText: trimForLineMessage(replyText)
  };
}

module.exports = {
  generateFreeRetrievalReply,
  buildEmptyReply,
  buildRankedReply
};
