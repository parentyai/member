'use strict';

const {
  normalizeText,
  normalizeInteger,
  normalizeBoolean,
  normalizeObject,
  normalizeStringArray,
  toIsoString,
  buildDeterministicUuid,
  mapAuthorityTierToCanonical,
  mapBindingLevelToCanonical,
  slugify
} = require('./canonicalCoreCompatMapping');

const SUPPORTED_TARGET_TABLES = new Set([
  'source_registry',
  'source_snapshot',
  'evidence_claim',
  'knowledge_object'
]);

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return defaultValue === true;
}

function isCanonicalCoreTypedMaterializerEnabled() {
  return resolveBooleanEnvFlag('ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_V1', false);
}

function isCanonicalCoreTypedMaterializerStrictEnabled() {
  return resolveBooleanEnvFlag('ENABLE_CANONICAL_CORE_TYPED_MATERIALIZER_STRICT_V1', false);
}

function normalizeTargetTables(value) {
  if (!value || typeof value !== 'object') return [];
  const hints = value.materializationHints && typeof value.materializationHints === 'object'
    ? value.materializationHints
    : {};
  const tables = normalizeStringArray(hints.targetTables).map((row) => row.toLowerCase());
  return tables.filter((table, index) => SUPPORTED_TARGET_TABLES.has(table) && tables.indexOf(table) === index);
}

function normalizeSourceRegistryRow(payload) {
  const row = payload && typeof payload === 'object' ? payload : {};
  return {
    sourceId: normalizeText(row.sourceId, null),
    canonicalKey: normalizeText(row.canonicalKey, null),
    sourceName: normalizeText(row.sourceName, null),
    ownerOrg: normalizeText(row.ownerOrg, null),
    authorityTier: mapAuthorityTierToCanonical(row.authorityTier, 'T3'),
    bindingLevel: mapBindingLevelToCanonical(row.bindingLevel, 'informative'),
    countryCode: normalizeText(row.countryCode, 'TBD'),
    scopeKey: normalizeText(row.scopeKey, 'GLOBAL'),
    domain: normalizeText(row.domain, 'unknown'),
    topic: normalizeText(row.topic, null),
    canonicalUrl: normalizeText(row.canonicalUrl, null),
    contentType: normalizeText(row.contentType, null),
    parserType: normalizeText(row.parserType, null),
    refreshCadence: normalizeText(row.refreshCadence, null),
    freshnessSlaDays: normalizeInteger(row.freshnessSlaDays, 30, 1),
    conflictPriority: normalizeInteger(row.conflictPriority, 100, 1),
    reviewerStatus: normalizeText(row.reviewerStatus, 'draft'),
    activeFlag: normalizeBoolean(row.activeFlag, true),
    staleFlag: normalizeBoolean(row.staleFlag, false),
    linkRegistryRef: normalizeText(row.linkRegistryRef, null),
    metadata: normalizeObject(row.metadata, {}),
    lastVerifiedAt: toIsoString(row.lastVerifiedAt, null),
    nextCheckAt: toIsoString(row.nextCheckAt, null)
  };
}

function normalizeSourceSnapshotRow(payload) {
  const row = payload && typeof payload === 'object' ? payload : {};
  const canonicalKey = normalizeText(row.canonicalKey, null);
  const sourceId = normalizeText(row.sourceId, null);
  return {
    snapshotId: normalizeText(row.snapshotId, buildDeterministicUuid(canonicalKey || `${sourceId || 'source'}:${normalizeText(row.contentHash, 'missing')}`)),
    sourceId,
    fetchUrl: normalizeText(row.fetchUrl, null),
    storageUri: normalizeText(row.storageUri, null),
    contentHash: normalizeText(row.contentHash, `missing:${sourceId || 'unknown'}`),
    observedAt: toIsoString(row.observedAt, new Date().toISOString()),
    sourcePublishedAt: toIsoString(row.sourcePublishedAt, null),
    effectiveFrom: toIsoString(row.effectiveFrom, null),
    effectiveTo: toIsoString(row.effectiveTo, null),
    parseStatus: normalizeText(row.parseStatus, 'pending'),
    isLatest: normalizeBoolean(row.isLatest, false),
    rawTextExcerpt: normalizeText(row.rawTextExcerpt, null),
    extractedJson: normalizeObject(row.extractedJson, {}),
    diffSummary: normalizeObject(row.diffSummary, {}),
    metadata: normalizeObject(row.metadata, {})
  };
}

function normalizeEvidenceClaimRow(payload) {
  const row = payload && typeof payload === 'object' ? payload : {};
  const canonicalKey = normalizeText(row.canonicalKey, null);
  return {
    claimId: normalizeText(row.claimId, buildDeterministicUuid(canonicalKey || 'evidence-claim')),
    canonicalKey,
    claimType: normalizeText(row.claimType, 'compat_claim'),
    title: normalizeText(row.title, canonicalKey || 'compat claim'),
    claimText: normalizeText(row.claimText, 'compat claim'),
    normalizedFact: normalizeObject(row.normalizedFact, {}),
    countryCode: normalizeText(row.countryCode, 'TBD'),
    scopeKey: normalizeText(row.scopeKey, 'GLOBAL'),
    subjectType: normalizeText(row.subjectType, null),
    actorRole: normalizeText(row.actorRole, null),
    authorityTier: mapAuthorityTierToCanonical(row.authorityTier, 'T2'),
    bindingLevel: mapBindingLevelToCanonical(row.bindingLevel, 'informative'),
    confidenceScore: Number.isFinite(Number(row.confidenceScore)) ? Math.max(0, Math.min(1, Number(row.confidenceScore))) : 1,
    corroborationCount: normalizeInteger(row.corroborationCount, 1, 1),
    freshnessSlaDays: normalizeInteger(row.freshnessSlaDays, 30, 1),
    effectiveFrom: toIsoString(row.effectiveFrom, null),
    effectiveTo: toIsoString(row.effectiveTo, null),
    reviewerStatus: normalizeText(row.reviewerStatus, 'draft'),
    activeFlag: normalizeBoolean(row.activeFlag, false),
    staleFlag: normalizeBoolean(row.staleFlag, false),
    lastVerifiedAt: toIsoString(row.lastVerifiedAt, null),
    nextCheckAt: toIsoString(row.nextCheckAt, null),
    metadata: normalizeObject(row.metadata, {})
  };
}

function normalizeKnowledgeObjectRow(payload) {
  const row = payload && typeof payload === 'object' ? payload : {};
  const canonicalKey = normalizeText(row.canonicalKey, null);
  const title = normalizeText(row.title, canonicalKey || 'compat knowledge');
  return {
    objectId: normalizeText(row.objectId, buildDeterministicUuid(canonicalKey || title)),
    canonicalKey,
    objectType: normalizeText(row.objectType, 'knowledge_object'),
    title,
    slug: normalizeText(row.slug, slugify(title, 'compat-knowledge')),
    domain: normalizeText(row.domain, 'general'),
    subdomain: normalizeText(row.subdomain, null),
    topic: normalizeText(row.topic, 'general'),
    topicDetail: normalizeText(row.topicDetail, null),
    countryCode: normalizeText(row.countryCode, 'TBD'),
    scopeKey: normalizeText(row.scopeKey, 'GLOBAL'),
    audienceScope: Array.isArray(row.audienceScope) ? row.audienceScope : [],
    householdScope: Array.isArray(row.householdScope) ? row.householdScope : [],
    visaScope: Array.isArray(row.visaScope) ? row.visaScope : [],
    assignmentTypeScope: Array.isArray(row.assignmentTypeScope) ? row.assignmentTypeScope : [],
    companyPolicyScope: normalizeObject(row.companyPolicyScope, {}),
    summaryMd: normalizeText(row.summaryMd, null),
    bodyMd: normalizeText(row.bodyMd, null),
    stepsJson: Array.isArray(row.stepsJson) ? row.stepsJson : [],
    prerequisitesJson: Array.isArray(row.prerequisitesJson) ? row.prerequisitesJson : [],
    requiredDocsJson: Array.isArray(row.requiredDocsJson) ? row.requiredDocsJson : [],
    formCodesJson: Array.isArray(row.formCodesJson) ? row.formCodesJson : [],
    channelsJson: Array.isArray(row.channelsJson) ? row.channelsJson : [],
    systemCodesJson: Array.isArray(row.systemCodesJson) ? row.systemCodesJson : [],
    feeAmount: Number.isFinite(Number(row.feeAmount)) ? Number(row.feeAmount) : null,
    feeCurrency: normalizeText(row.feeCurrency, null),
    costNotes: normalizeText(row.costNotes, null),
    waitTimeMinDays: Number.isFinite(Number(row.waitTimeMinDays)) ? Math.floor(Number(row.waitTimeMinDays)) : null,
    waitTimeMaxDays: Number.isFinite(Number(row.waitTimeMaxDays)) ? Math.floor(Number(row.waitTimeMaxDays)) : null,
    processTimeMinDays: Number.isFinite(Number(row.processTimeMinDays)) ? Math.floor(Number(row.processTimeMinDays)) : null,
    processTimeMaxDays: Number.isFinite(Number(row.processTimeMaxDays)) ? Math.floor(Number(row.processTimeMaxDays)) : null,
    validityDays: Number.isFinite(Number(row.validityDays)) ? Math.floor(Number(row.validityDays)) : null,
    retentionDays: Number.isFinite(Number(row.retentionDays)) ? Math.floor(Number(row.retentionDays)) : null,
    authorityFloor: mapAuthorityTierToCanonical(row.authorityFloor, 'T3'),
    bindingLevel: mapBindingLevelToCanonical(row.bindingLevel, 'informative'),
    freshnessSlaDays: normalizeInteger(row.freshnessSlaDays, 30, 1),
    effectiveFrom: toIsoString(row.effectiveFrom, null),
    effectiveTo: toIsoString(row.effectiveTo, null),
    reviewerStatus: normalizeText(row.reviewerStatus, 'draft'),
    ownerTeam: normalizeText(row.ownerTeam, null),
    activeFlag: normalizeBoolean(row.activeFlag, false),
    staleFlag: normalizeBoolean(row.staleFlag, false),
    lastVerifiedAt: toIsoString(row.lastVerifiedAt, null),
    nextCheckAt: toIsoString(row.nextCheckAt, null),
    metadata: normalizeObject(row.metadata, {})
  };
}

async function upsertSourceRegistry(pool, payload) {
  const row = normalizeSourceRegistryRow(payload);
  const sql = `
INSERT INTO source_registry (
  source_id,
  canonical_key,
  source_name,
  owner_org,
  authority_tier,
  binding_level,
  country_code,
  scope_key,
  domain,
  topic,
  canonical_url,
  content_type,
  parser_type,
  refresh_cadence,
  freshness_sla_days,
  conflict_priority,
  reviewer_status,
  active_flag,
  stale_flag,
  link_registry_ref,
  metadata,
  last_verified_at,
  next_check_at,
  updated_at
)
VALUES (
  $1,$2,$3,$4,$5::authority_tier,$6::binding_level,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::reviewer_status,$18,$19,$20,$21::jsonb,$22,$23,NOW()
)
ON CONFLICT (source_id) DO UPDATE
SET
  canonical_key = EXCLUDED.canonical_key,
  source_name = EXCLUDED.source_name,
  owner_org = EXCLUDED.owner_org,
  authority_tier = EXCLUDED.authority_tier,
  binding_level = EXCLUDED.binding_level,
  country_code = EXCLUDED.country_code,
  scope_key = EXCLUDED.scope_key,
  domain = EXCLUDED.domain,
  topic = EXCLUDED.topic,
  canonical_url = EXCLUDED.canonical_url,
  content_type = EXCLUDED.content_type,
  parser_type = EXCLUDED.parser_type,
  refresh_cadence = EXCLUDED.refresh_cadence,
  freshness_sla_days = EXCLUDED.freshness_sla_days,
  conflict_priority = EXCLUDED.conflict_priority,
  reviewer_status = EXCLUDED.reviewer_status,
  active_flag = EXCLUDED.active_flag,
  stale_flag = EXCLUDED.stale_flag,
  link_registry_ref = EXCLUDED.link_registry_ref,
  metadata = EXCLUDED.metadata,
  last_verified_at = EXCLUDED.last_verified_at,
  next_check_at = EXCLUDED.next_check_at,
  updated_at = NOW()
RETURNING source_id
`.trim();
  const values = [
    row.sourceId,
    row.canonicalKey,
    row.sourceName,
    row.ownerOrg,
    row.authorityTier,
    row.bindingLevel,
    row.countryCode,
    row.scopeKey,
    row.domain,
    row.topic,
    row.canonicalUrl,
    row.contentType,
    row.parserType,
    row.refreshCadence,
    row.freshnessSlaDays,
    row.conflictPriority,
    row.reviewerStatus,
    row.activeFlag,
    row.staleFlag,
    row.linkRegistryRef,
    JSON.stringify(row.metadata),
    row.lastVerifiedAt,
    row.nextCheckAt
  ];
  const result = await pool.query(sql, values);
  return { table: 'source_registry', recordId: `source_registry:${(result.rows[0] || {}).source_id || row.sourceId}` };
}

async function upsertSourceSnapshot(pool, payload) {
  const row = normalizeSourceSnapshotRow(payload);
  const sql = `
INSERT INTO source_snapshot (
  snapshot_id,
  source_id,
  fetch_url,
  storage_uri,
  content_hash,
  observed_at,
  source_published_at,
  effective_from,
  effective_to,
  parse_status,
  is_latest,
  raw_text_excerpt,
  extracted_json,
  diff_summary,
  metadata
)
VALUES (
  $1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb
)
ON CONFLICT (snapshot_id) DO UPDATE
SET
  source_id = EXCLUDED.source_id,
  fetch_url = EXCLUDED.fetch_url,
  storage_uri = EXCLUDED.storage_uri,
  content_hash = EXCLUDED.content_hash,
  observed_at = EXCLUDED.observed_at,
  source_published_at = EXCLUDED.source_published_at,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  parse_status = EXCLUDED.parse_status,
  is_latest = EXCLUDED.is_latest,
  raw_text_excerpt = EXCLUDED.raw_text_excerpt,
  extracted_json = EXCLUDED.extracted_json,
  diff_summary = EXCLUDED.diff_summary,
  metadata = EXCLUDED.metadata
RETURNING snapshot_id
`.trim();
  const values = [
    row.snapshotId,
    row.sourceId,
    row.fetchUrl,
    row.storageUri,
    row.contentHash,
    row.observedAt,
    row.sourcePublishedAt,
    row.effectiveFrom,
    row.effectiveTo,
    row.parseStatus,
    row.isLatest,
    row.rawTextExcerpt,
    JSON.stringify(row.extractedJson),
    JSON.stringify(row.diffSummary),
    JSON.stringify(row.metadata)
  ];
  const result = await pool.query(sql, values);
  return { table: 'source_snapshot', recordId: `source_snapshot:${(result.rows[0] || {}).snapshot_id || row.snapshotId}` };
}

async function upsertEvidenceClaim(pool, payload) {
  const row = normalizeEvidenceClaimRow(payload);
  const sql = `
INSERT INTO evidence_claim (
  claim_id,
  canonical_key,
  claim_type,
  title,
  claim_text,
  normalized_fact,
  country_code,
  scope_key,
  subject_type,
  actor_role,
  authority_tier,
  binding_level,
  confidence_score,
  corroboration_count,
  freshness_sla_days,
  effective_from,
  effective_to,
  reviewer_status,
  active_flag,
  stale_flag,
  last_verified_at,
  next_check_at,
  metadata,
  updated_at
)
VALUES (
  $1::uuid,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11::authority_tier,$12::binding_level,$13,$14,$15,$16,$17,$18::reviewer_status,$19,$20,$21,$22,$23::jsonb,NOW()
)
ON CONFLICT (claim_id) DO UPDATE
SET
  canonical_key = EXCLUDED.canonical_key,
  claim_type = EXCLUDED.claim_type,
  title = EXCLUDED.title,
  claim_text = EXCLUDED.claim_text,
  normalized_fact = EXCLUDED.normalized_fact,
  country_code = EXCLUDED.country_code,
  scope_key = EXCLUDED.scope_key,
  subject_type = EXCLUDED.subject_type,
  actor_role = EXCLUDED.actor_role,
  authority_tier = EXCLUDED.authority_tier,
  binding_level = EXCLUDED.binding_level,
  confidence_score = EXCLUDED.confidence_score,
  corroboration_count = EXCLUDED.corroboration_count,
  freshness_sla_days = EXCLUDED.freshness_sla_days,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  reviewer_status = EXCLUDED.reviewer_status,
  active_flag = EXCLUDED.active_flag,
  stale_flag = EXCLUDED.stale_flag,
  last_verified_at = EXCLUDED.last_verified_at,
  next_check_at = EXCLUDED.next_check_at,
  metadata = EXCLUDED.metadata,
  updated_at = NOW()
RETURNING claim_id
`.trim();
  const values = [
    row.claimId,
    row.canonicalKey,
    row.claimType,
    row.title,
    row.claimText,
    JSON.stringify(row.normalizedFact),
    row.countryCode,
    row.scopeKey,
    row.subjectType,
    row.actorRole,
    row.authorityTier,
    row.bindingLevel,
    row.confidenceScore,
    row.corroborationCount,
    row.freshnessSlaDays,
    row.effectiveFrom,
    row.effectiveTo,
    row.reviewerStatus,
    row.activeFlag,
    row.staleFlag,
    row.lastVerifiedAt,
    row.nextCheckAt,
    JSON.stringify(row.metadata)
  ];
  const result = await pool.query(sql, values);
  return { table: 'evidence_claim', recordId: `evidence_claim:${(result.rows[0] || {}).claim_id || row.claimId}` };
}

async function upsertKnowledgeObject(pool, payload) {
  const row = normalizeKnowledgeObjectRow(payload);
  const sql = `
INSERT INTO knowledge_object (
  object_id,
  canonical_key,
  object_type,
  title,
  slug,
  domain,
  subdomain,
  topic,
  topic_detail,
  country_code,
  scope_key,
  audience_scope,
  household_scope,
  visa_scope,
  assignment_type_scope,
  company_policy_scope,
  summary_md,
  body_md,
  steps_json,
  prerequisites_json,
  required_docs_json,
  form_codes_json,
  channels_json,
  system_codes_json,
  fee_amount,
  fee_currency,
  cost_notes,
  wait_time_min_days,
  wait_time_max_days,
  process_time_min_days,
  process_time_max_days,
  validity_days,
  retention_days,
  authority_floor,
  binding_level,
  freshness_sla_days,
  effective_from,
  effective_to,
  reviewer_status,
  owner_team,
  active_flag,
  stale_flag,
  last_verified_at,
  next_check_at,
  metadata,
  updated_at
)
VALUES (
  $1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17,$18,$19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,$24::jsonb,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34::authority_tier,$35::binding_level,$36,$37,$38,$39::reviewer_status,$40,$41,$42,$43,$44,$45::jsonb,NOW()
)
ON CONFLICT (object_id) DO UPDATE
SET
  canonical_key = EXCLUDED.canonical_key,
  object_type = EXCLUDED.object_type,
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  domain = EXCLUDED.domain,
  subdomain = EXCLUDED.subdomain,
  topic = EXCLUDED.topic,
  topic_detail = EXCLUDED.topic_detail,
  country_code = EXCLUDED.country_code,
  scope_key = EXCLUDED.scope_key,
  audience_scope = EXCLUDED.audience_scope,
  household_scope = EXCLUDED.household_scope,
  visa_scope = EXCLUDED.visa_scope,
  assignment_type_scope = EXCLUDED.assignment_type_scope,
  company_policy_scope = EXCLUDED.company_policy_scope,
  summary_md = EXCLUDED.summary_md,
  body_md = EXCLUDED.body_md,
  steps_json = EXCLUDED.steps_json,
  prerequisites_json = EXCLUDED.prerequisites_json,
  required_docs_json = EXCLUDED.required_docs_json,
  form_codes_json = EXCLUDED.form_codes_json,
  channels_json = EXCLUDED.channels_json,
  system_codes_json = EXCLUDED.system_codes_json,
  fee_amount = EXCLUDED.fee_amount,
  fee_currency = EXCLUDED.fee_currency,
  cost_notes = EXCLUDED.cost_notes,
  wait_time_min_days = EXCLUDED.wait_time_min_days,
  wait_time_max_days = EXCLUDED.wait_time_max_days,
  process_time_min_days = EXCLUDED.process_time_min_days,
  process_time_max_days = EXCLUDED.process_time_max_days,
  validity_days = EXCLUDED.validity_days,
  retention_days = EXCLUDED.retention_days,
  authority_floor = EXCLUDED.authority_floor,
  binding_level = EXCLUDED.binding_level,
  freshness_sla_days = EXCLUDED.freshness_sla_days,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  reviewer_status = EXCLUDED.reviewer_status,
  owner_team = EXCLUDED.owner_team,
  active_flag = EXCLUDED.active_flag,
  stale_flag = EXCLUDED.stale_flag,
  last_verified_at = EXCLUDED.last_verified_at,
  next_check_at = EXCLUDED.next_check_at,
  metadata = EXCLUDED.metadata,
  updated_at = NOW()
RETURNING object_id
`.trim();
  const values = [
    row.objectId,
    row.canonicalKey,
    row.objectType,
    row.title,
    row.slug,
    row.domain,
    row.subdomain,
    row.topic,
    row.topicDetail,
    row.countryCode,
    row.scopeKey,
    JSON.stringify(row.audienceScope),
    JSON.stringify(row.householdScope),
    JSON.stringify(row.visaScope),
    JSON.stringify(row.assignmentTypeScope),
    JSON.stringify(row.companyPolicyScope),
    row.summaryMd,
    row.bodyMd,
    JSON.stringify(row.stepsJson),
    JSON.stringify(row.prerequisitesJson),
    JSON.stringify(row.requiredDocsJson),
    JSON.stringify(row.formCodesJson),
    JSON.stringify(row.channelsJson),
    JSON.stringify(row.systemCodesJson),
    row.feeAmount,
    row.feeCurrency,
    row.costNotes,
    row.waitTimeMinDays,
    row.waitTimeMaxDays,
    row.processTimeMinDays,
    row.processTimeMaxDays,
    row.validityDays,
    row.retentionDays,
    row.authorityFloor,
    row.bindingLevel,
    row.freshnessSlaDays,
    row.effectiveFrom,
    row.effectiveTo,
    row.reviewerStatus,
    row.ownerTeam,
    row.activeFlag,
    row.staleFlag,
    row.lastVerifiedAt,
    row.nextCheckAt,
    JSON.stringify(row.metadata)
  ];
  const result = await pool.query(sql, values);
  return { table: 'knowledge_object', recordId: `knowledge_object:${(result.rows[0] || {}).object_id || row.objectId}` };
}

async function materializeTypedTable(pool, tableName, canonicalPayload) {
  if (tableName === 'source_registry') return upsertSourceRegistry(pool, canonicalPayload.sourceRegistry);
  if (tableName === 'source_snapshot') return upsertSourceSnapshot(pool, canonicalPayload.sourceSnapshot);
  if (tableName === 'evidence_claim') return upsertEvidenceClaim(pool, canonicalPayload.evidenceClaim);
  if (tableName === 'knowledge_object') return upsertKnowledgeObject(pool, canonicalPayload.knowledgeObject);
  return { table: tableName, status: 'unsupported' };
}

async function materializeCanonicalCoreTypedTables(event, deps) {
  if (!isCanonicalCoreTypedMaterializerEnabled()) {
    return {
      enabled: false,
      strict: isCanonicalCoreTypedMaterializerStrictEnabled(),
      tables: []
    };
  }

  const strict = isCanonicalCoreTypedMaterializerStrictEnabled();
  const pool = deps && deps.pool ? deps.pool : null;
  if (!pool || typeof pool.query !== 'function') {
    const error = new Error('typed_materializer_pool_missing');
    error.code = 'typed_materializer_pool_missing';
    if (strict) throw error;
    return {
      enabled: true,
      strict,
      tables: [{
        table: 'typed_materializer',
        status: 'skipped',
        reason: 'pool_missing'
      }]
    };
  }

  const canonicalPayload = event && event.canonicalPayload && typeof event.canonicalPayload === 'object'
    ? event.canonicalPayload
    : {};
  const targetTables = normalizeTargetTables(event);
  if (!targetTables.length) {
    return {
      enabled: true,
      strict,
      tables: [{
        table: 'typed_materializer',
        status: 'skipped',
        reason: 'no_supported_target_tables'
      }]
    };
  }

  const tables = [];
  for (const tableName of targetTables) {
    try {
      const result = await materializeTypedTable(pool, tableName, canonicalPayload);
      if (result && result.recordId) {
        tables.push({
          table: tableName,
          status: 'materialized',
          recordId: result.recordId
        });
      } else {
        tables.push({
          table: tableName,
          status: 'skipped',
          reason: 'payload_missing'
        });
      }
    } catch (error) {
      if (strict) throw error;
      tables.push({
        table: tableName,
        status: 'skipped',
        reason: error && error.code ? String(error.code) : 'typed_materializer_failed'
      });
    }
  }

  return {
    enabled: true,
    strict,
    tables
  };
}

module.exports = {
  isCanonicalCoreTypedMaterializerEnabled,
  isCanonicalCoreTypedMaterializerStrictEnabled,
  materializeCanonicalCoreTypedTables
};
