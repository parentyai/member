'use strict';

const { getDb } = require('../../infra/firestore');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const { assertRecordEnvelopeCompliance } = require('../../domain/data/universalRecordEnvelopeCompliance');
const { appendCanonicalCoreOutboxEvent } = require('./canonicalCoreOutboxRepo');
const {
  deriveKnowledgeLifecycleState,
  resolveKnowledgeLifecycleBucket,
  normalizeKnowledgeLifecycleBucket,
  assertKnowledgeLifecycleTransition,
  isKnowledgeLifecycleState
} = require('../../domain/data/knowledgeLifecycleStateMachine');

const COLLECTION = 'faq_articles';
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const ALLOWED_STATUSES = new Set(['active', 'draft', 'disabled']);
const ALLOWED_RISK_LEVELS = new Set(['low', 'medium', 'high']);

function resolveFaqArticleAuthorityTier(article) {
  const payload = article && typeof article === 'object' ? article : {};
  const risk = normalizeRiskLevel(payload.riskLevel);
  if (risk === 'high') return 'T1_OFFICIAL_OPERATION';
  if (risk === 'medium') return 'T2_PUBLIC_DATA';
  return 'T3_VENDOR';
}

function resolveFaqArticleBindingLevel(article) {
  const payload = article && typeof article === 'object' ? article : {};
  const risk = normalizeRiskLevel(payload.riskLevel);
  if (risk === 'high') return 'POLICY';
  return 'REFERENCE';
}

function buildFaqArticleEnvelope(articleId, article, existingEnvelope) {
  const payload = article && typeof article === 'object' ? article : {};
  const existing = existingEnvelope && typeof existingEnvelope === 'object' ? existingEnvelope : {};
  const sourceSnapshotRef = typeof payload.versionSemver === 'string' && payload.versionSemver.trim()
    ? `faq_article:${payload.versionSemver.trim()}`
    : (typeof payload.version === 'string' && payload.version.trim()
      ? `faq_article:${payload.version.trim()}`
      : 'faq_article:unknown');
  return buildUniversalRecordEnvelope({
    recordId: articleId,
    recordType: 'knowledge_object',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef,
    effectiveFrom: payload.createdAt || new Date().toISOString(),
    effectiveTo: payload.validUntil || null,
    authorityTier: resolveFaqArticleAuthorityTier(payload),
    bindingLevel: resolveFaqArticleBindingLevel(payload),
    jurisdiction: typeof payload.locale === 'string' && payload.locale.trim() ? payload.locale.trim() : null,
    status: payload.status || 'draft',
    retentionTag: 'faq_articles_365d',
    piiClass: 'none',
    accessScope: ['operator', 'retrieval'],
    maskingPolicy: 'none',
    deletionPolicy: 'retention_policy_v1',
    createdAt: existing.created_at || payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

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

function countTokenMatches(textTokens, queryToken) {
  let count = 0;
  for (const token of textTokens) {
    if (token === queryToken) count += 1;
  }
  return count;
}

function toLowerSet(items) {
  return new Set(normalizeStringArray(items).map((v) => v.toLowerCase()));
}

function normalizeStatus(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(normalized)) return null;
  return normalized;
}

function normalizeRiskLevel(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!ALLOWED_RISK_LEVELS.has(normalized)) return null;
  return normalized;
}

function normalizeAllowedIntents(value) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  const normalized = value
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().toUpperCase());
  return normalized;
}

function normalizeVersionValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (!SEMVER_PATTERN.test(normalized)) return null;
  return normalized;
}

function normalizeKnowledgeLifecycleFields(payload, fallbackState, options) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const strict = Boolean(options && options.strict === true);
  if (Object.prototype.hasOwnProperty.call(source, 'knowledgeLifecycleState')
    && !isKnowledgeLifecycleState(source.knowledgeLifecycleState)) {
    if (strict) throw new Error('knowledgeLifecycleState invalid');
  }
  const lifecycleInput = Object.prototype.hasOwnProperty.call(source, 'knowledgeLifecycleState')
    && !isKnowledgeLifecycleState(source.knowledgeLifecycleState)
    ? undefined
    : source.knowledgeLifecycleState;
  const knowledgeLifecycleState = deriveKnowledgeLifecycleState({
    knowledgeLifecycleState: lifecycleInput,
    status: source.status,
    fallbackState: fallbackState || 'candidate'
  });
  const knowledgeLifecycleBucket = normalizeKnowledgeLifecycleBucket(
    source.knowledgeLifecycleBucket,
    resolveKnowledgeLifecycleBucket(knowledgeLifecycleState)
  );
  return {
    knowledgeLifecycleState,
    knowledgeLifecycleBucket
  };
}

function normalizeKbArticleForSearch(article) {
  if (!article || typeof article !== 'object') return null;
  const status = normalizeStatus(article.status);
  if (status === null) return null;
  const riskLevel = normalizeRiskLevel(article.riskLevel);
  if (riskLevel === null) return null;
  const allowedIntents = normalizeAllowedIntents(article.allowedIntents);
  if (!allowedIntents) return null;
  const version = normalizeVersionValue(article.version);
  const versionSemver = normalizeVersionValue(article.versionSemver);
  if ((article.version !== undefined && article.version !== null && version === null)
    || (article.versionSemver !== undefined && article.versionSemver !== null && versionSemver === null)) {
    return null;
  }
  const lifecycle = normalizeKnowledgeLifecycleFields(
    {
      knowledgeLifecycleState: article.knowledgeLifecycleState,
      knowledgeLifecycleBucket: article.knowledgeLifecycleBucket,
      status
    },
    'candidate'
  );
  return Object.assign({}, article, {
    status,
    riskLevel,
    allowedIntents,
    version: version || versionSemver || null,
    versionSemver: versionSemver || version || null,
    knowledgeLifecycleState: lifecycle.knowledgeLifecycleState,
    knowledgeLifecycleBucket: lifecycle.knowledgeLifecycleBucket
  });
}

function estimateDocLength(article) {
  const titleTokens = normalizeTokens(article && article.title);
  const bodyTokens = normalizeTokens(article && article.body);
  const keywords = normalizeStringArray(article && article.keywords);
  const synonyms = normalizeStringArray(article && article.synonyms);
  const tags = normalizeStringArray(article && article.tags);
  const length = titleTokens.length + bodyTokens.length + keywords.length + synonyms.length + tags.length;
  return Math.max(1, length);
}

function bm25(tf, docLength, avgDocLength) {
  if (!Number.isFinite(tf) || tf <= 0) return 0;
  const k1 = 1.2;
  const b = 0.75;
  const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  return (tf * (k1 + 1)) / denominator;
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value.toDate === 'function') {
    const asDate = value.toDate();
    if (asDate instanceof Date) {
      const ms = asDate.getTime();
      return Number.isFinite(ms) ? ms : null;
    }
  }
  if (typeof value.toMillis === 'function') {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function isValidByTime(article, nowMs) {
  if (!article || article.validUntil === undefined || article.validUntil === null) return true;
  const untilMs = toMillis(article.validUntil);
  if (untilMs === null) return false;
  return untilMs > nowMs;
}

function isIntentAllowed(article, resolvedIntent) {
  const allowed = normalizeStringArray(article && article.allowedIntents).map((v) => v.toUpperCase());
  if (!allowed.length) return true;
  return allowed.includes(String(resolvedIntent || '').toUpperCase());
}

function scoreArticle(article, tokens, intent, context) {
  const keywordSet = toLowerSet(article.keywords);
  const synonymSet = toLowerSet(article.synonyms);
  const tagSet = toLowerSet(article.tags);
  const titleTokens = normalizeTokens(article.title);
  const bodyTokens = normalizeTokens(article.body);
  const docLength = estimateDocLength(article);
  const avgDocLength = context && Number.isFinite(context.avgDocLength) && context.avgDocLength > 0 ? context.avgDocLength : docLength;
  let score = 0;
  for (const token of tokens) {
    let tf = 0;
    if (keywordSet.has(token)) tf += 3;
    if (synonymSet.has(token)) tf += 2;
    if (tagSet.has(token)) tf += 1;
    const titleHits = countTokenMatches(titleTokens, token);
    const bodyHits = countTokenMatches(bodyTokens, token);
    tf += titleHits * 1.5;
    tf += bodyHits * 0.5;
    score += bm25(tf, docLength, avgDocLength);
  }
  if (typeof intent === 'string' && intent.trim().length > 0) {
    const intentUpper = String(intent).trim().toUpperCase();
    const allowed = normalizeStringArray(article.allowedIntents).map((item) => item.toUpperCase());
    if (allowed.length === 0) return score;
    if (allowed.includes(intentUpper)) score += 3;
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
  const intent = typeof payload.intent === 'string' && payload.intent.trim().length > 0 ? payload.intent.trim() : 'FAQ';
  const knowledgeLifecycleBucket = normalizeKnowledgeLifecycleBucket(
    payload.knowledgeLifecycleBucket,
    'approved_knowledge'
  );
  const nowMs = toMillis(payload.now) || Date.now();

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
  const normalizedRows = rows
    .map((row) => normalizeKbArticleForSearch(row))
    .filter((row) => row !== null)
    .filter((row) => String(row.locale || '').trim() === locale);
  const filtered = normalizedRows
    .filter((row) => isValidByTime(row, nowMs))
    .filter((row) => row.knowledgeLifecycleBucket === knowledgeLifecycleBucket)
    .filter((row) => isIntentAllowed(row, intent));
  const avgDocLength =
    filtered.length > 0 ? filtered.reduce((sum, row) => sum + estimateDocLength(row), 0) / filtered.length : 1;
  const scored = filtered
    .map((row) => ({ row, score: scoreArticle(row, tokens, intent, { avgDocLength }) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      const av = String(a.row.updatedAt || '');
      const bv = String(b.row.updatedAt || '');
      return bv.localeCompare(av);
    })
    .slice(0, limit)
    .map((item) => Object.assign({}, item.row, { searchScore: Number(item.score.toFixed(6)) }));

  return scored;
}

function validateKbArticle(data) {
  const errors = [];
  const payload = data || {};

  const status = normalizeStatus(payload.status);
  if (status === null) errors.push('status: must be one of active|draft|disabled');

  const riskLevel = normalizeRiskLevel(payload.riskLevel);
  if (riskLevel === null) errors.push('riskLevel: must be one of low|medium|high');

  const version = normalizeVersionValue(payload.version);
  const versionSemver = normalizeVersionValue(payload.versionSemver);
  if (version === null && versionSemver === null) {
    errors.push('version: must be a semver string (e.g. "1.0.0"); at least one of version/versionSemver required');
  }

  if (payload.validUntil === null || payload.validUntil === undefined) {
    errors.push('validUntil: required (use a future ISO date or Firestore Timestamp)');
  }

  const allowedIntents = normalizeAllowedIntents(payload.allowedIntents);
  if (allowedIntents === null) {
    errors.push('allowedIntents: must be an array (use [] to allow all intents)');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'knowledgeLifecycleState')
    && !isKnowledgeLifecycleState(payload.knowledgeLifecycleState)) {
    errors.push('knowledgeLifecycleState: must be one of candidate|approved|rejected|deprecated');
  }

  return { valid: errors.length === 0, errors };
}

async function createArticle(data) {
  const { valid, errors } = validateKbArticle(data);
  if (!valid) {
    const err = new Error('kb_schema_invalid');
    err.failureCode = 'kb_schema_invalid';
    err.errors = errors;
    throw err;
  }
  const db = getDb();
  const now = new Date().toISOString();
  const lifecycle = normalizeKnowledgeLifecycleFields(data, 'candidate', { strict: true });
  const baseRecord = Object.assign({}, data, {
    knowledgeLifecycleState: lifecycle.knowledgeLifecycleState,
    knowledgeLifecycleBucket: lifecycle.knowledgeLifecycleBucket,
    createdAt: now,
    updatedAt: now
  });
  const docRef = db.collection(COLLECTION).doc();
  const recordEnvelope = buildFaqArticleEnvelope(docRef.id, baseRecord, null);
  assertRecordEnvelopeCompliance({ dataClass: 'faq_articles', recordEnvelope });
  const record = Object.assign({}, baseRecord, { recordEnvelope });
  await docRef.set(record);
  await appendCanonicalCoreOutboxEvent({
    objectType: 'knowledge_object',
    objectId: docRef.id,
    eventType: 'upsert',
    recordEnvelope,
    payloadSummary: {
      lifecycleState: lifecycle.knowledgeLifecycleState,
      lifecycleBucket: lifecycle.knowledgeLifecycleBucket,
      status: record.status,
      locale: record.locale,
      riskLevel: record.riskLevel
    }
  });
  return { id: docRef.id };
}

async function updateArticle(id, patch) {
  if (!id) throw new Error('article id required');
  const db = getDb();
  const now = new Date().toISOString();
  const current = await getArticle(id);
  const fromState = normalizeKnowledgeLifecycleFields(
    {
      knowledgeLifecycleState: current && current.knowledgeLifecycleState,
      knowledgeLifecycleBucket: current && current.knowledgeLifecycleBucket,
      status: current && current.status
    },
    'candidate',
    { strict: false }
  ).knowledgeLifecycleState;
  const lifecycleInput = {
    status: Object.prototype.hasOwnProperty.call(patch || {}, 'status')
      ? patch.status
      : (current && current.status)
  };
  if (Object.prototype.hasOwnProperty.call(patch || {}, 'knowledgeLifecycleState')) {
    lifecycleInput.knowledgeLifecycleState = patch.knowledgeLifecycleState;
  }
  if (Object.prototype.hasOwnProperty.call(patch || {}, 'knowledgeLifecycleBucket')) {
    lifecycleInput.knowledgeLifecycleBucket = patch.knowledgeLifecycleBucket;
  }
  const lifecycle = normalizeKnowledgeLifecycleFields(lifecycleInput, fromState, { strict: true });
  assertKnowledgeLifecycleTransition({
    fromState,
    toState: lifecycle.knowledgeLifecycleState
  });
  const merged = Object.assign({}, current || {}, patch || {}, {
    knowledgeLifecycleState: lifecycle.knowledgeLifecycleState,
    knowledgeLifecycleBucket: lifecycle.knowledgeLifecycleBucket,
    updatedAt: now
  });
  const recordEnvelope = buildFaqArticleEnvelope(id, merged, current && current.recordEnvelope);
  assertRecordEnvelopeCompliance({ dataClass: 'faq_articles', recordEnvelope });
  await db.collection(COLLECTION).doc(id).set(
    Object.assign({}, patch, {
      knowledgeLifecycleState: lifecycle.knowledgeLifecycleState,
      knowledgeLifecycleBucket: lifecycle.knowledgeLifecycleBucket,
      recordEnvelope,
      updatedAt: now
    }),
    { merge: true }
  );
  await appendCanonicalCoreOutboxEvent({
    objectType: 'knowledge_object',
    objectId: id,
    eventType: 'upsert',
    recordEnvelope,
    payloadSummary: {
      lifecycleState: lifecycle.knowledgeLifecycleState,
      lifecycleBucket: lifecycle.knowledgeLifecycleBucket,
      status: merged.status,
      locale: merged.locale,
      riskLevel: merged.riskLevel
    }
  });
  return { id };
}

async function deleteArticle(id) {
  if (!id) throw new Error('article id required');
  const db = getDb();
  const now = new Date().toISOString();
  const current = await getArticle(id);
  const lifecycle = normalizeKnowledgeLifecycleFields({ status: 'disabled' }, 'deprecated', { strict: false });
  const merged = Object.assign({}, current || {}, {
    status: 'disabled',
    knowledgeLifecycleState: lifecycle.knowledgeLifecycleState,
    knowledgeLifecycleBucket: lifecycle.knowledgeLifecycleBucket,
    deletedAt: now,
    updatedAt: now
  });
  const recordEnvelope = buildFaqArticleEnvelope(id, merged, current && current.recordEnvelope);
  assertRecordEnvelopeCompliance({ dataClass: 'faq_articles', recordEnvelope });
  await db.collection(COLLECTION).doc(id).set(
    {
      status: 'disabled',
      knowledgeLifecycleState: lifecycle.knowledgeLifecycleState,
      knowledgeLifecycleBucket: lifecycle.knowledgeLifecycleBucket,
      recordEnvelope,
      deletedAt: now,
      updatedAt: now
    },
    { merge: true }
  );
  await appendCanonicalCoreOutboxEvent({
    objectType: 'knowledge_object',
    objectId: id,
    eventType: 'delete',
    recordEnvelope,
    payloadSummary: {
      lifecycleState: lifecycle.knowledgeLifecycleState,
      lifecycleBucket: lifecycle.knowledgeLifecycleBucket,
      status: 'disabled',
      locale: merged.locale,
      riskLevel: merged.riskLevel
    }
  });
  return { id };
}

async function listArticles(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = Number.isFinite(Number(payload.limit))
    ? Math.min(Math.max(Math.floor(Number(payload.limit)), 1), 500)
    : 100;
  const status = normalizeStatus(payload.status);
  const db = getDb();
  let query = db.collection(COLLECTION);
  if (status) query = query.where('status', '==', status);
  const snap = await query.limit(limit).get();
  return snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
}

module.exports = {
  getArticle,
  listArticles,
  searchActiveArticles,
  validateKbArticle,
  createArticle,
  updateArticle,
  deleteArticle
};
