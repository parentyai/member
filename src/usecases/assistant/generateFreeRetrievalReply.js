'use strict';

const { searchFaqFromKb } = require('../faq/searchFaqFromKb');
const { searchCityPackCandidates } = require('./retrieval/searchCityPackCandidates');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function trimForLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 4500 ? `${text.slice(0, 4500)}...` : text;
}

function buildEmptyReply(question) {
  const title = normalizeText(question) || 'ご質問';
  return [
    `${title} に一致する情報が見つかりませんでした。`,
    '',
    '次にできること:',
    '1. キーワードを短くして再検索',
    '2. 都市名/期限/手続き名を追加して再送',
    '3. 不明点は運用窓口へお問い合わせください'
  ].join('\n');
}

function buildRankedReply(question, faqCandidates, cityPackCandidates) {
  const lines = [];
  const title = normalizeText(question) || '検索結果';
  lines.push(`${title} の関連情報です。`);
  lines.push('');

  if (faqCandidates.length) {
    lines.push('FAQ候補');
    faqCandidates.slice(0, 3).forEach((item, index) => {
      const score = Number.isFinite(Number(item.searchScore)) ? Number(item.searchScore) : 0;
      lines.push(`${index + 1}. ${item.title || '-'} (score=${score})`);
      lines.push(`根拠キー: ${item.articleId}`);
    });
    lines.push('');
  }

  if (cityPackCandidates.length) {
    lines.push('CityPack候補');
    cityPackCandidates.slice(0, 2).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title || '-'} (${item.reason || 'city_pack_match'})`);
      lines.push(`根拠キー: ${item.sourceId}`);
    });
    lines.push('');
  }

  lines.push('必要なら「抜け漏れチェック」「次アクション」を送ってPro支援を試せます。');
  return lines.join('\n').trim();
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
  const citations = [];

  faqCandidates.forEach((row) => {
    const key = normalizeText(row && row.articleId);
    if (key && !citations.includes(key)) citations.push(key);
  });
  cityPackCandidates.forEach((row) => {
    const key = normalizeText(row && row.sourceId);
    if (key && !citations.includes(key)) citations.push(key);
  });

  const mode = faqCandidates.length || cityPackCandidates.length ? 'ranked' : 'empty';
  const replyText = mode === 'ranked'
    ? buildRankedReply(question, faqCandidates, cityPackCandidates)
    : buildEmptyReply(question);

  return {
    ok: true,
    mode,
    citations,
    faqCandidates,
    cityPackCandidates,
    replyText: trimForLineMessage(replyText)
  };
}

module.exports = {
  generateFreeRetrievalReply,
  buildEmptyReply,
  buildRankedReply
};
