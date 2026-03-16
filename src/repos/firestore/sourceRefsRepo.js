'use strict';

const crypto = require('crypto');
const { getDb, serverTimestamp } = require('../../infra/firestore');
const { toMillis } = require('./queryFallback');
const { buildUniversalRecordEnvelope } = require('../../domain/data/universalRecordEnvelope');
const { assertRecordEnvelopeCompliance } = require('../../domain/data/universalRecordEnvelopeCompliance');
const {
  deriveKnowledgeLifecycleState,
  resolveKnowledgeLifecycleBucket,
  assertKnowledgeLifecycleTransition,
  isKnowledgeLifecycleState,
  normalizeKnowledgeLifecycleBucket
} = require('../../domain/data/knowledgeLifecycleStateMachine');
const { appendCanonicalCoreOutboxEvent } = require('./canonicalCoreOutboxRepo');
const {
  mapAuthorityTierToCanonical,
  mapBindingLevelToCanonical,
  extractHostname,
  resolveCountryCodeFromRegionKey,
  resolveScopeKey,
  resolveReviewerStatus,
  resolveStaleFlag,
  resolvePositiveDaySpan,
  toIsoString,
  normalizeObject
} = require('../../domain/data/canonicalCoreCompatMapping');

const COLLECTION = 'source_refs';
const VALIDITY_DAYS = 120;
const ALLOWED_STATUS = new Set(['active', 'needs_review', 'dead', 'blocked', 'retired']);
const ALLOWED_RISK_LEVEL = new Set(['low', 'medium', 'high']);
const ALLOWED_SOURCE_TYPE = new Set(['official', 'semi_official', 'community', 'other']);
const ALLOWED_REQUIRED_LEVEL = new Set(['required', 'optional']);
const ALLOWED_AUTHORITY_LEVEL = new Set(['federal', 'state', 'local', 'other']);
const ALLOWED_AUDIT_STAGE = new Set(['light', 'heavy']);
const ALLOWED_DOMAIN_CLASS = new Set(['gov', 'k12_district', 'school_public', 'unknown']);
const ALLOWED_SCHOOL_TYPE = new Set(['public', 'private', 'unknown']);
const ALLOWED_EDU_SCOPE = new Set(['calendar', 'district_info', 'enrollment', 'closure_alert']);

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return defaultValue === true;
}

function resolvePositiveIntEnv(name, fallback, min, max) {
  const raw = process.env[name];
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  const value = Math.floor(num);
  if (Number.isFinite(min) && value < min) return min;
  if (Number.isFinite(max) && value > max) return max;
  return value;
}

function isSourceRefsBufferedLimitEnabled() {
  return resolveBooleanEnvFlag('ENABLE_CITY_PACK_SOURCE_REFS_BUFFERED_LIMIT_V1', true);
}

function resolveSourceRefsBufferMultiplier() {
  return resolvePositiveIntEnv('CITY_PACK_SOURCE_REFS_BUFFER_MULTIPLIER', 5, 1, 20);
}

function resolveSourceRefsScanMax() {
  return resolvePositiveIntEnv('CITY_PACK_SOURCE_REFS_SCAN_MAX', 1000, 1, 1000);
}

function normalizeStatus(value) {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_STATUS.has(status) ? status : 'needs_review';
}

function normalizeRiskLevel(value) {
  const risk = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_RISK_LEVEL.has(risk) ? risk : 'medium';
}

function normalizeSourceType(value) {
  const sourceType = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_SOURCE_TYPE.has(sourceType) ? sourceType : 'other';
}

function normalizeRequiredLevel(value) {
  const requiredLevel = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_REQUIRED_LEVEL.has(requiredLevel) ? requiredLevel : 'required';
}

function normalizeAuthorityLevel(value) {
  const authorityLevel = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_AUTHORITY_LEVEL.has(authorityLevel) ? authorityLevel : 'other';
}

function resolveSourceTypeFilter(value) {
  if (typeof value !== 'string') return null;
  const sourceType = value.trim().toLowerCase();
  if (!sourceType) return null;
  return ALLOWED_SOURCE_TYPE.has(sourceType) ? sourceType : null;
}

function resolveAuthorityLevelFilter(value) {
  if (typeof value !== 'string') return null;
  const authorityLevel = value.trim().toLowerCase();
  if (!authorityLevel) return null;
  return ALLOWED_AUTHORITY_LEVEL.has(authorityLevel) ? authorityLevel : null;
}

function normalizeAuditStage(value) {
  const stage = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_AUDIT_STAGE.has(stage) ? stage : null;
}

function normalizeDomainClass(value) {
  const domainClass = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_DOMAIN_CLASS.has(domainClass) ? domainClass : 'unknown';
}

function normalizeSchoolType(value) {
  const schoolType = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ALLOWED_SCHOOL_TYPE.has(schoolType) ? schoolType : 'unknown';
}

function normalizeEduScope(value) {
  const eduScope = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!eduScope) return null;
  return ALLOWED_EDU_SCOPE.has(eduScope) ? eduScope : null;
}

function normalizeRegionKey(value) {
  if (typeof value !== 'string') return null;
  const regionKey = value.trim().toLowerCase();
  return regionKey || null;
}

function resolveSchoolTypeFilter(value) {
  if (typeof value !== 'string') return null;
  const schoolType = value.trim().toLowerCase();
  if (!schoolType) return null;
  return ALLOWED_SCHOOL_TYPE.has(schoolType) ? schoolType : null;
}

function resolveEduScopeFilter(value) {
  if (typeof value !== 'string') return null;
  const eduScope = value.trim().toLowerCase();
  if (!eduScope) return null;
  return ALLOWED_EDU_SCOPE.has(eduScope) ? eduScope : null;
}

function resolveRegionKeyFilter(value) {
  if (typeof value !== 'string') return null;
  const regionKey = value.trim().toLowerCase();
  return regionKey || null;
}

function resolveKnowledgeLifecycleBucketFilter(value) {
  if (typeof value !== 'string') return null;
  const bucket = value.trim().toLowerCase();
  if (!bucket) return null;
  if (bucket !== 'approved_knowledge' && bucket !== 'candidate_knowledge') return null;
  return bucket;
}

function normalizeConfidenceScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, Math.round(num)));
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(baseDate, days) {
  const next = new Date(baseDate.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function resolveValidFrom(data) {
  const now = new Date();
  const validFrom = toDate(data && data.validFrom);
  return validFrom || now;
}

function resolveValidUntil(data) {
  const validUntil = toDate(data && data.validUntil);
  if (validUntil) return validUntil;
  const validFrom = resolveValidFrom(data);
  return addDays(validFrom, VALIDITY_DAYS);
}

function normalizeArray(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim())));
}

function normalizeSourceRefData(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const knowledgeLifecycleState = deriveKnowledgeLifecycleState({
    knowledgeLifecycleState: payload.knowledgeLifecycleState,
    status: payload.status,
    fallbackState: payload.fallbackState
  });
  const knowledgeLifecycleBucket = normalizeKnowledgeLifecycleBucket(
    payload.knowledgeLifecycleBucket,
    resolveKnowledgeLifecycleBucket(knowledgeLifecycleState)
  );
  return {
    url: typeof payload.url === 'string' ? payload.url.trim() : '',
    status: normalizeStatus(payload.status),
    knowledgeLifecycleState,
    knowledgeLifecycleBucket,
    validFrom: resolveValidFrom(payload),
    validUntil: resolveValidUntil(payload),
    lastResult: typeof payload.lastResult === 'string' ? payload.lastResult.trim() : null,
    lastCheckAt: toDate(payload.lastCheckAt),
    contentHash: typeof payload.contentHash === 'string' ? payload.contentHash.trim() : null,
    riskLevel: normalizeRiskLevel(payload.riskLevel),
    sourceType: normalizeSourceType(payload.sourceType),
    requiredLevel: normalizeRequiredLevel(payload.requiredLevel),
    authorityLevel: normalizeAuthorityLevel(payload.authorityLevel),
    confidenceScore: normalizeConfidenceScore(payload.confidenceScore),
    lastAuditStage: normalizeAuditStage(payload.lastAuditStage),
    domainClass: normalizeDomainClass(payload.domainClass),
    schoolType: normalizeSchoolType(payload.schoolType),
    eduScope: normalizeEduScope(payload.eduScope),
    regionKey: normalizeRegionKey(payload.regionKey),
    evidenceLatestId: typeof payload.evidenceLatestId === 'string' ? payload.evidenceLatestId.trim() : null,
    usedByCityPackIds: normalizeArray(payload.usedByCityPackIds)
  };
}

function normalizeSourcePolicyPatch(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const output = {
    sourceType: normalizeSourceType(payload.sourceType),
    requiredLevel: normalizeRequiredLevel(payload.requiredLevel)
  };
  if (Object.prototype.hasOwnProperty.call(payload, 'authorityLevel')) {
    output.authorityLevel = normalizeAuthorityLevel(payload.authorityLevel);
  }
  return output;
}

function ensureUrl(url) {
  if (!url) throw new Error('url required');
  try {
    const parsed = new URL(url);
    if (!parsed.protocol || !parsed.host) throw new Error('url invalid');
  } catch (_err) {
    throw new Error('url invalid');
  }
}

function resolveId(data) {
  const payload = data && typeof data === 'object' ? data : {};
  if (typeof payload.id === 'string' && payload.id.trim()) return payload.id.trim();
  return `sr_${crypto.randomUUID()}`;
}

function resolveSourceAuthorityTier(normalized) {
  if (!normalized || typeof normalized !== 'object') return 'UNKNOWN';
  if (normalized.sourceType === 'official') return 'T1_OFFICIAL_OPERATION';
  if (normalized.sourceType === 'semi_official') return 'T2_PUBLIC_DATA';
  if (normalized.sourceType === 'community') return 'T4_COMMUNITY';
  return 'T3_VENDOR';
}

function resolveSourceBindingLevel(normalized) {
  if (!normalized || typeof normalized !== 'object') return 'UNKNOWN';
  if (normalized.requiredLevel === 'required') return 'POLICY';
  if (normalized.requiredLevel === 'optional') return 'REFERENCE';
  return 'UNKNOWN';
}

function buildSourceRefEnvelope(sourceRefId, normalized, existingEnvelope) {
  const payload = normalized && typeof normalized === 'object' ? normalized : {};
  const sourceSnapshotRef = typeof payload.contentHash === 'string' && payload.contentHash.trim()
    ? `source_ref:${payload.contentHash.trim()}`
    : 'source_ref:unknown';
  const effectiveFrom = payload.validFrom || new Date().toISOString();
  const effectiveTo = payload.validUntil || null;
  const previousCreatedAt = existingEnvelope && typeof existingEnvelope === 'object'
    ? existingEnvelope.created_at
    : null;
  return buildUniversalRecordEnvelope({
    recordId: sourceRefId,
    recordType: 'source_ref',
    sourceSystem: 'member_firestore',
    sourceSnapshotRef,
    effectiveFrom,
    effectiveTo,
    authorityTier: resolveSourceAuthorityTier(payload),
    bindingLevel: resolveSourceBindingLevel(payload),
    jurisdiction: typeof payload.regionKey === 'string' && payload.regionKey.trim() ? payload.regionKey.trim() : null,
    status: payload.status || 'active',
    retentionTag: 'source_refs_365d',
    piiClass: 'none',
    accessScope: ['operator', 'retrieval'],
    maskingPolicy: 'none',
    deletionPolicy: 'retention_policy_v1',
    createdAt: previousCreatedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function buildSourceRefCanonicalPayload(sourceRefId, normalized, recordEnvelope) {
  const authorityTier = mapAuthorityTierToCanonical(resolveSourceAuthorityTier(normalized), 'T3');
  const bindingLevel = mapBindingLevelToCanonical(resolveSourceBindingLevel(normalized), 'informative');
  const hostname = extractHostname(normalized.url, sourceRefId);
  const countryCode = resolveCountryCodeFromRegionKey(normalized.regionKey, 'TBD');
  const scopeKey = resolveScopeKey(normalized.regionKey, 'GLOBAL');
  const effectiveFrom = toIsoString(normalized.validFrom, new Date().toISOString());
  const effectiveTo = toIsoString(normalized.validUntil, null);
  const freshnessSlaDays = resolvePositiveDaySpan(normalized.validFrom, normalized.validUntil, VALIDITY_DAYS);
  const reviewerStatus = resolveReviewerStatus({
    status: normalized.status,
    lifecycleState: normalized.knowledgeLifecycleState
  }, 'draft');
  const staleFlag = resolveStaleFlag({
    status: normalized.status,
    effectiveTo: normalized.validUntil
  });
  const snapshotCanonicalKey = `source_snapshot:${sourceRefId}:${normalized.contentHash || 'missing'}`;

  return {
    sourceRegistry: {
      sourceId: sourceRefId,
      canonicalKey: `source_registry:${sourceRefId}`,
      sourceName: hostname,
      ownerOrg: hostname,
      authorityTier,
      bindingLevel,
      countryCode,
      scopeKey,
      domain: normalized.domainClass || 'unknown',
      topic: normalized.eduScope || null,
      canonicalUrl: normalized.url,
      contentType: null,
      parserType: normalized.lastAuditStage ? `source_refs_${normalized.lastAuditStage}` : null,
      refreshCadence: `${VALIDITY_DAYS}d`,
      freshnessSlaDays,
      conflictPriority: 100,
      reviewerStatus,
      activeFlag: normalized.status === 'active',
      staleFlag,
      linkRegistryRef: null,
      lastVerifiedAt: toIsoString(normalized.lastCheckAt, null),
      nextCheckAt: effectiveTo,
      metadata: normalizeObject({
        sourceType: normalized.sourceType,
        requiredLevel: normalized.requiredLevel,
        authorityLevel: normalized.authorityLevel,
        confidenceScore: normalized.confidenceScore,
        domainClass: normalized.domainClass,
        schoolType: normalized.schoolType,
        eduScope: normalized.eduScope,
        regionKey: normalized.regionKey,
        evidenceLatestId: normalized.evidenceLatestId,
        usedByCityPackIds: normalized.usedByCityPackIds,
        recordEnvelope
      }, {})
    },
    sourceSnapshot: {
      canonicalKey: snapshotCanonicalKey,
      sourceId: sourceRefId,
      fetchUrl: normalized.url,
      storageUri: null,
      contentHash: normalized.contentHash || `missing:${sourceRefId}`,
      observedAt: toIsoString(normalized.lastCheckAt, effectiveFrom),
      sourcePublishedAt: null,
      effectiveFrom,
      effectiveTo,
      parseStatus: normalized.status,
      isLatest: normalized.status === 'active',
      rawTextExcerpt: null,
      extractedJson: normalizeObject({
        status: normalized.status,
        sourceType: normalized.sourceType,
        requiredLevel: normalized.requiredLevel,
        authorityLevel: normalized.authorityLevel,
        riskLevel: normalized.riskLevel,
        domainClass: normalized.domainClass,
        schoolType: normalized.schoolType,
        eduScope: normalized.eduScope,
        regionKey: normalized.regionKey,
        confidenceScore: normalized.confidenceScore,
        lastResult: normalized.lastResult,
        lastAuditStage: normalized.lastAuditStage,
        evidenceLatestId: normalized.evidenceLatestId,
        usedByCityPackIds: normalized.usedByCityPackIds
      }, {}),
      diffSummary: normalizeObject({
        lifecycleState: normalized.knowledgeLifecycleState,
        lifecycleBucket: normalized.knowledgeLifecycleBucket,
        status: normalized.status,
        riskLevel: normalized.riskLevel
      }, {}),
      metadata: normalizeObject({
        sourceRefId,
        snapshotRef: recordEnvelope && recordEnvelope.source_snapshot_ref ? recordEnvelope.source_snapshot_ref : null
      }, {})
    }
  };
}

function buildSourceRefSourceLinks(sourceRefId, normalized, recordEnvelope) {
  return [{
    sourceId: sourceRefId,
    snapshotRef: recordEnvelope && recordEnvelope.source_snapshot_ref ? recordEnvelope.source_snapshot_ref : null,
    linkRole: 'primary',
    primary: true,
    canonicalSnapshotKey: `source_snapshot:${sourceRefId}:${normalized.contentHash || 'missing'}`
  }];
}

async function createSourceRef(data) {
  if (data && typeof data === 'object'
    && Object.prototype.hasOwnProperty.call(data, 'knowledgeLifecycleState')
    && !isKnowledgeLifecycleState(data.knowledgeLifecycleState)) {
    throw new Error('knowledgeLifecycleState invalid');
  }
  const normalized = normalizeSourceRefData(data);
  ensureUrl(normalized.url);
  const id = resolveId(data);
  const db = getDb();
  const recordEnvelope = buildSourceRefEnvelope(id, normalized, null);
  assertRecordEnvelopeCompliance({ dataClass: 'source_refs', recordEnvelope });
  await db.collection(COLLECTION).doc(id).set({
    url: normalized.url,
    status: normalized.status,
    knowledgeLifecycleState: normalized.knowledgeLifecycleState,
    knowledgeLifecycleBucket: normalized.knowledgeLifecycleBucket,
    validFrom: normalized.validFrom,
    validUntil: normalized.validUntil,
    lastResult: normalized.lastResult,
    lastCheckAt: normalized.lastCheckAt,
    contentHash: normalized.contentHash,
    riskLevel: normalized.riskLevel,
    sourceType: normalized.sourceType,
    requiredLevel: normalized.requiredLevel,
    authorityLevel: normalized.authorityLevel,
    confidenceScore: normalized.confidenceScore,
    lastAuditStage: normalized.lastAuditStage,
    domainClass: normalized.domainClass,
    schoolType: normalized.schoolType,
    eduScope: normalized.eduScope,
    regionKey: normalized.regionKey,
    evidenceLatestId: normalized.evidenceLatestId,
    usedByCityPackIds: normalized.usedByCityPackIds,
    recordEnvelope,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: false });

  await appendCanonicalCoreOutboxEvent({
    objectType: 'source_snapshot',
    objectId: id,
    eventType: 'upsert',
    recordEnvelope,
    canonicalPayload: buildSourceRefCanonicalPayload(id, normalized, recordEnvelope),
    sourceLinks: buildSourceRefSourceLinks(id, normalized, recordEnvelope),
    materializationHints: {
      targetTables: ['source_registry', 'source_snapshot']
    },
    payloadSummary: {
      lifecycleState: normalized.knowledgeLifecycleState,
      lifecycleBucket: normalized.knowledgeLifecycleBucket,
      status: normalized.status,
      riskLevel: normalized.riskLevel
    }
  });
  return { id };
}

async function getSourceRef(sourceRefId) {
  if (!sourceRefId) throw new Error('sourceRefId required');
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(sourceRefId).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function listSourceRefs(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const db = getDb();
  const limit = Number.isFinite(Number(opts.limit)) ? Math.min(Math.max(Math.floor(Number(opts.limit)), 1), 1000) : 100;
  const expiringBeforeMs = opts.expiringBefore ? toMillis(opts.expiringBefore) : null;
  let baseQuery = db.collection(COLLECTION);
  if (opts.status) {
    const status = normalizeStatus(opts.status);
    baseQuery = baseQuery.where('status', '==', status);
  }
  const sourceType = resolveSourceTypeFilter(opts.sourceType);
  if (sourceType) baseQuery = baseQuery.where('sourceType', '==', sourceType);
  const authorityLevel = resolveAuthorityLevelFilter(opts.authorityLevel);
  if (authorityLevel) baseQuery = baseQuery.where('authorityLevel', '==', authorityLevel);
  const knowledgeLifecycleBucketFilter = resolveKnowledgeLifecycleBucketFilter(opts.knowledgeLifecycleBucket);
  const schoolTypeFilter = resolveSchoolTypeFilter(opts.schoolType);
  const eduScopeFilter = resolveEduScopeFilter(opts.eduScope);
  const regionKeyFilter = resolveRegionKeyFilter(opts.regionKey);
  const bufferedEnabled = isSourceRefsBufferedLimitEnabled();
  const hasPostFilter = Boolean(
    knowledgeLifecycleBucketFilter
    || schoolTypeFilter
    || eduScopeFilter
    || regionKeyFilter
    || expiringBeforeMs
  );
  const bufferMultiplier = resolveSourceRefsBufferMultiplier();
  const scanMax = resolveSourceRefsScanMax();
  const readLimit = hasPostFilter && bufferedEnabled
    ? Math.min(Math.max(limit * bufferMultiplier, limit), scanMax)
    : limit;

  const snap = await baseQuery.orderBy('updatedAt', 'desc').limit(readLimit).get();
  const rows = snap.docs.map((doc) => Object.assign({ id: doc.id }, doc.data()));
  const filteredRows = rows.filter((row) => {
    if (knowledgeLifecycleBucketFilter) {
      const lifecycleBucket = normalizeKnowledgeLifecycleBucket(
        row && row.knowledgeLifecycleBucket,
        resolveKnowledgeLifecycleBucket(deriveKnowledgeLifecycleState({
          knowledgeLifecycleState: row && row.knowledgeLifecycleState,
          status: row && row.status,
          fallbackState: 'candidate'
        }))
      );
      if (lifecycleBucket !== knowledgeLifecycleBucketFilter) return false;
    }
    if (schoolTypeFilter) {
      const schoolType = typeof row.schoolType === 'string' ? row.schoolType.toLowerCase() : 'unknown';
      if (schoolType !== schoolTypeFilter) return false;
    }
    if (eduScopeFilter) {
      const eduScope = typeof row.eduScope === 'string' ? row.eduScope.toLowerCase() : '';
      if (eduScope !== eduScopeFilter) return false;
    }
    if (regionKeyFilter) {
      const regionKey = typeof row.regionKey === 'string' ? row.regionKey.toLowerCase() : '';
      if (regionKey !== regionKeyFilter) return false;
    }
    return true;
  });
  const expiringFilteredRows = !expiringBeforeMs
    ? filteredRows
    : filteredRows.filter((row) => {
    const validUntilMs = toMillis(row && row.validUntil);
    return validUntilMs > 0 && validUntilMs <= expiringBeforeMs;
  });

  if (!hasPostFilter || !bufferedEnabled) return expiringFilteredRows;
  return expiringFilteredRows.slice(0, limit);
}

async function listSourceRefsForAudit(params) {
  const opts = params && typeof params === 'object' ? params : {};
  const now = toDate(opts.now) || new Date();
  const horizonDays = Number.isFinite(Number(opts.horizonDays)) ? Math.max(Math.floor(Number(opts.horizonDays)), 0) : 14;
  const horizonMs = addDays(now, horizonDays).getTime();
  const all = await listSourceRefs({ limit: Number.isFinite(Number(opts.limit)) ? Number(opts.limit) : 300 });
  return all.filter((row) => {
    const status = normalizeStatus(row && row.status);
    if (status === 'needs_review') return true;
    if (status === 'active') {
      const validUntilMs = toMillis(row && row.validUntil);
      return validUntilMs > 0 && validUntilMs <= horizonMs;
    }
    return false;
  }).sort((a, b) => toMillis(a && a.validUntil) - toMillis(b && b.validUntil));
}

async function updateSourceRef(sourceRefId, patch) {
  if (!sourceRefId) throw new Error('sourceRefId required');
  const current = await getSourceRef(sourceRefId);
  const payload = patch && typeof patch === 'object' ? Object.assign({}, patch) : {};
  if (Object.prototype.hasOwnProperty.call(payload, 'knowledgeLifecycleState')
    && !isKnowledgeLifecycleState(payload.knowledgeLifecycleState)) {
    throw new Error('knowledgeLifecycleState invalid');
  }
  const currentLifecycleState = deriveKnowledgeLifecycleState({
    knowledgeLifecycleState: current && current.knowledgeLifecycleState,
    status: current && current.status,
    fallbackState: 'candidate'
  });
  const nextLifecycleState = deriveKnowledgeLifecycleState({
    knowledgeLifecycleState: Object.prototype.hasOwnProperty.call(payload, 'knowledgeLifecycleState')
      ? payload.knowledgeLifecycleState
      : undefined,
    status: Object.prototype.hasOwnProperty.call(payload, 'status')
      ? payload.status
      : (current && current.status),
    fallbackState: currentLifecycleState
  });
  assertKnowledgeLifecycleTransition({
    fromState: currentLifecycleState,
    toState: nextLifecycleState
  });
  payload.knowledgeLifecycleState = nextLifecycleState;
  payload.knowledgeLifecycleBucket = resolveKnowledgeLifecycleBucket(nextLifecycleState);
  const mergedForEnvelope = normalizeSourceRefData(Object.assign({}, current || {}, payload));
  payload.recordEnvelope = buildSourceRefEnvelope(sourceRefId, mergedForEnvelope, current && current.recordEnvelope);
  assertRecordEnvelopeCompliance({ dataClass: 'source_refs', recordEnvelope: payload.recordEnvelope });
  payload.updatedAt = serverTimestamp();
  const db = getDb();
  await db.collection(COLLECTION).doc(sourceRefId).set(payload, { merge: true });

  await appendCanonicalCoreOutboxEvent({
    objectType: 'source_snapshot',
    objectId: sourceRefId,
    eventType: 'upsert',
    recordEnvelope: payload.recordEnvelope,
    canonicalPayload: buildSourceRefCanonicalPayload(sourceRefId, mergedForEnvelope, payload.recordEnvelope),
    sourceLinks: buildSourceRefSourceLinks(sourceRefId, mergedForEnvelope, payload.recordEnvelope),
    materializationHints: {
      targetTables: ['source_registry', 'source_snapshot']
    },
    payloadSummary: {
      lifecycleState: nextLifecycleState,
      lifecycleBucket: resolveKnowledgeLifecycleBucket(nextLifecycleState),
      status: mergedForEnvelope.status,
      riskLevel: mergedForEnvelope.riskLevel
    }
  });
  return { id: sourceRefId };
}

async function linkCityPack(sourceRefId, cityPackId) {
  if (!sourceRefId) throw new Error('sourceRefId required');
  if (!cityPackId) throw new Error('cityPackId required');
  const current = await getSourceRef(sourceRefId);
  if (!current) throw new Error('sourceRef not found');
  const next = normalizeArray([].concat(current.usedByCityPackIds || [], [cityPackId]));
  await updateSourceRef(sourceRefId, { usedByCityPackIds: next });
  return { id: sourceRefId, usedByCityPackIds: next };
}

module.exports = {
  VALIDITY_DAYS,
  normalizeAuditStage,
  normalizeAuthorityLevel,
  normalizeConfidenceScore,
  normalizeRequiredLevel,
  normalizeSourcePolicyPatch,
  createSourceRef,
  getSourceRef,
  listSourceRefs,
  listSourceRefsForAudit,
  updateSourceRef,
  linkCityPack
};
