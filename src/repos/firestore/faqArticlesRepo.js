'use strict';

const { getDb } = require('../../infra/firestore');

const COLLECTION = 'faq_articles';

function normalizeTokens(value) {
  if (typeof value !== 'string') return [];
  return value
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

function scoreArticle(article, tokens, intent) {
  const keywordSet = new Set(normalizeStringArray(article.keywords).map((v) => v.toLowerCase()));
  const synonymSet = new Set(normalizeStringArray(article.synonyms).map((v) => v.toLowerCase()));
  const tagSet = new Set(normalizeStringArray(article.tags).map((v) => v.toLowerCase()));
  let score = 0;
  for (const token of tokens) {
    if (keywordSet.has(token)) score += 3;
    if (synonymSet.has(token)) score += 2;
    if (tagSet.has(token)) score += 1;
  }
  if (typeof intent === 'string' && intent.trim().length > 0) {
    const allowed = normalizeStringArray(article.allowedIntents);
    if (allowed.length === 0) return score;
    if (allowed.includes(intent)) score += 3;
    else score -= 1000;
  }
  return score;
}

async function getArticle(id) {
  if (!id) throw new Error('article id required');
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc(id);
  const snap = await docRef.get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function searchActiveArticles(params) {
  const payload = params || {};
  const locale = typeof payload.locale === 'string' && payload.locale.trim().length > 0 ? payload.locale.trim() : 'ja';
  const query = typeof payload.query === 'string' ? payload.query : '';
  const limit = Number.isInteger(payload.limit) && payload.limit > 0 ? payload.limit : 5;
  const intent = typeof payload.intent === 'string' && payload.intent.trim().length > 0 ? payload.intent.trim() : null;

  const db = getDb();
  let snap;
  try {
    snap = await db
      .collection(COLLECTION)
      .where('status', '==', 'active')
      .where('locale', '==', locale)
      .get();
  } catch (_err) {
    snap = await db
      .collection(COLLECTION)
      .where('status', '==', 'active')
      .get();
  }

  const tokens = normalizeTokens(query);
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  const scored = rows
    .map((row) => ({ row, score: scoreArticle(row, tokens, intent) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const av = String(a.row.updatedAt || '');
      const bv = String(b.row.updatedAt || '');
      return bv.localeCompare(av);
    })
    .slice(0, limit)
    .map((item) => item.row);

  return scored;
}

module.exports = {
  getArticle,
  searchActiveArticles
};
