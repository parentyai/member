'use strict';

const faqArticlesRepo = require('../../repos/firestore/faqArticlesRepo');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildDefaultReply(question) {
  const title = normalizeText(question) || 'ご質問内容';
  return `${title} に一致するFAQが見つかりませんでした。\n\n1. 公式FAQのキーワードを変えて再検索\n2. 必要な条件を追記して再送\n3. 緊急時は運用窓口へ連絡`;
}

function buildReplyFromCandidates(question, candidates) {
  const header = normalizeText(question) || 'FAQ候補';
  const lines = [`${header} のFAQ候補です。`, ''];
  candidates.forEach((row, index) => {
    const rank = index + 1;
    lines.push(`${rank}. ${row.title || '-'} (score=${row.searchScore})`);
    lines.push(`引用キー: ${row.articleId}`);
    lines.push('');
  });
  return lines.join('\n').trim();
}

async function searchFaqFromKb(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const question = normalizeText(payload.question);
  const locale = normalizeText(payload.locale) || 'ja';
  const limit = Number.isInteger(payload.limit) && payload.limit > 0 ? Math.min(payload.limit, 5) : 3;

  const rows = await faqArticlesRepo.searchActiveArticles({
    query: question,
    locale,
    limit,
    intent: 'FAQ'
  });

  const candidates = (Array.isArray(rows) ? rows : []).map((row) => ({
    articleId: typeof row.id === 'string' ? row.id : '',
    title: typeof row.title === 'string' ? row.title : '',
    searchScore: Number.isFinite(Number(row.searchScore)) ? Number(row.searchScore) : 0,
    body: typeof row.body === 'string' ? row.body : ''
  }));

  if (!candidates.length) {
    return {
      ok: true,
      mode: 'empty',
      candidates: [],
      citations: [],
      replyText: buildDefaultReply(question)
    };
  }

  return {
    ok: true,
    mode: 'ranked',
    candidates,
    citations: candidates.map((row) => row.articleId).filter(Boolean),
    replyText: buildReplyFromCandidates(question, candidates)
  };
}

module.exports = {
  searchFaqFromKb
};
