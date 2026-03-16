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
const {
  materializeGeneratedViewRecordFromEvent
} = require('./canonicalCoreGeneratedViewMapping');

const SUPPORTED_TARGET_TABLES = new Set([
  'source_registry',
  'source_snapshot',
  'evidence_claim',
  'knowledge_object',
  'task_template',
  'rule_set',
  'generated_view'
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

function normalizeTaskTemplateRow(payload) {
  const row = payload && typeof payload === 'object' ? payload : {};
  const taskCode = normalizeText(row.taskCode, 'compat-task-template');
  const canonicalKey = normalizeText(row.canonicalKey, `task_template:${taskCode}`);
  const title = normalizeText(row.title, taskCode);
  return {
    taskTemplateId: normalizeText(row.taskTemplateId, buildDeterministicUuid(canonicalKey || taskCode)),
    canonicalKey,
    objectId: normalizeText(row.objectId, null),
    taskCode,
    title,
    domain: normalizeText(row.domain, 'task_engine'),
    topic: normalizeText(row.topic, 'general'),
    countryCode: normalizeText(row.countryCode, 'TBD'),
    scopeKey: normalizeText(row.scopeKey, 'GLOBAL'),
    audienceScope: Array.isArray(row.audienceScope) ? row.audienceScope : [],
    householdScope: Array.isArray(row.householdScope) ? row.householdScope : [],
    visaScope: Array.isArray(row.visaScope) ? row.visaScope : [],
    triggerExpr: normalizeText(row.triggerExpr, '{}'),
    prerequisiteExpr: normalizeText(row.prerequisiteExpr, null),
    stopExpr: normalizeText(row.stopExpr, null),
    dueBasis: normalizeText(row.dueBasis, null),
    dueOffsetDays: Number.isFinite(Number(row.dueOffsetDays)) ? Math.floor(Number(row.dueOffsetDays)) : null,
    dueAtFixed: toIsoString(row.dueAtFixed, null),
    completionExpr: normalizeText(row.completionExpr, '{"taskStatus":"done"}'),
    stepsJson: Array.isArray(row.stepsJson) ? row.stepsJson : [],
    requiredFactKeys: Array.isArray(row.requiredFactKeys) ? row.requiredFactKeys : [],
    requiredDocTypes: Array.isArray(row.requiredDocTypes) ? row.requiredDocTypes : [],
    uiModuleIds: Array.isArray(row.uiModuleIds) ? row.uiModuleIds : [],
    notificationGuardFlags: Array.isArray(row.notificationGuardFlags) ? row.notificationGuardFlags : [],
    actionMapId: normalizeText(row.actionMapId, null),
    exceptionCode: normalizeText(row.exceptionCode, null),
    escalationJson: normalizeObject(row.escalationJson, {}),
    metricsKeys: Array.isArray(row.metricsKeys) ? row.metricsKeys : [],
    activeFlag: normalizeBoolean(row.activeFlag, false),
    reviewerStatus: normalizeText(row.reviewerStatus, 'draft'),
    publishBundleId: normalizeText(row.publishBundleId, null),
    metadata: normalizeObject(row.metadata, {})
  };
}

function normalizeRuleSetRow(payload) {
  const row = payload && typeof payload === 'object' ? payload : {};
  const ruleCode = normalizeText(row.ruleCode, 'compat-rule-set');
  const canonicalKey = normalizeText(row.canonicalKey, `rule_set:${ruleCode}`);
  return {
    ruleId: normalizeText(row.ruleId, buildDeterministicUuid(canonicalKey || ruleCode)),
    canonicalKey,
    ruleCode,
    ruleScope: normalizeText(row.ruleScope, 'GLOBAL'),
    exprLang: normalizeText(row.exprLang, 'jsonlogic'),
    triggerExpr: normalizeText(row.triggerExpr, null),
    exprBody: normalizeObject(row.exprBody, {}),
    outputPayload: normalizeObject(row.outputPayload, {}),
    priority: Number.isFinite(Number(row.priority)) ? Math.floor(Number(row.priority)) : 100,
    testFixture: normalizeObject(row.testFixture, {}),
    effectiveFrom: toIsoString(row.effectiveFrom, null),
    effectiveTo: toIsoString(row.effectiveTo, null),
    reviewerStatus: normalizeText(row.reviewerStatus, 'draft'),
    activeFlag: normalizeBoolean(row.activeFlag, false),
    publishBundleId: normalizeText(row.publishBundleId, null),
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

async function upsertTaskTemplate(pool, payload) {
  const row = normalizeTaskTemplateRow(payload);
  const sql = `
INSERT INTO task_template (
  task_template_id,
  canonical_key,
  object_id,
  task_code,
  title,
  domain,
  topic,
  country_code,
  scope_key,
  audience_scope,
  household_scope,
  visa_scope,
  trigger_expr,
  prerequisite_expr,
  stop_expr,
  due_basis,
  due_offset_days,
  due_at_fixed,
  completion_expr,
  steps_json,
  required_fact_keys,
  required_doc_types,
  ui_module_ids,
  notification_guard_flags,
  action_map_id,
  exception_code,
  escalation_json,
  metrics_keys,
  active_flag,
  reviewer_status,
  publish_bundle_id,
  metadata,
  updated_at
)
VALUES (
  $1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17,$18,$19,$20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,$24::jsonb,$25,$26,$27::jsonb,$28::jsonb,$29,$30::reviewer_status,$31::uuid,$32::jsonb,NOW()
)
ON CONFLICT (task_template_id) DO UPDATE
SET
  canonical_key = EXCLUDED.canonical_key,
  object_id = EXCLUDED.object_id,
  task_code = EXCLUDED.task_code,
  title = EXCLUDED.title,
  domain = EXCLUDED.domain,
  topic = EXCLUDED.topic,
  country_code = EXCLUDED.country_code,
  scope_key = EXCLUDED.scope_key,
  audience_scope = EXCLUDED.audience_scope,
  household_scope = EXCLUDED.household_scope,
  visa_scope = EXCLUDED.visa_scope,
  trigger_expr = EXCLUDED.trigger_expr,
  prerequisite_expr = EXCLUDED.prerequisite_expr,
  stop_expr = EXCLUDED.stop_expr,
  due_basis = EXCLUDED.due_basis,
  due_offset_days = EXCLUDED.due_offset_days,
  due_at_fixed = EXCLUDED.due_at_fixed,
  completion_expr = EXCLUDED.completion_expr,
  steps_json = EXCLUDED.steps_json,
  required_fact_keys = EXCLUDED.required_fact_keys,
  required_doc_types = EXCLUDED.required_doc_types,
  ui_module_ids = EXCLUDED.ui_module_ids,
  notification_guard_flags = EXCLUDED.notification_guard_flags,
  action_map_id = EXCLUDED.action_map_id,
  exception_code = EXCLUDED.exception_code,
  escalation_json = EXCLUDED.escalation_json,
  metrics_keys = EXCLUDED.metrics_keys,
  active_flag = EXCLUDED.active_flag,
  reviewer_status = EXCLUDED.reviewer_status,
  publish_bundle_id = EXCLUDED.publish_bundle_id,
  metadata = EXCLUDED.metadata,
  updated_at = NOW()
RETURNING task_template_id
`.trim();
  const values = [
    row.taskTemplateId,
    row.canonicalKey,
    row.objectId,
    row.taskCode,
    row.title,
    row.domain,
    row.topic,
    row.countryCode,
    row.scopeKey,
    JSON.stringify(row.audienceScope),
    JSON.stringify(row.householdScope),
    JSON.stringify(row.visaScope),
    row.triggerExpr,
    row.prerequisiteExpr,
    row.stopExpr,
    row.dueBasis,
    row.dueOffsetDays,
    row.dueAtFixed,
    row.completionExpr,
    JSON.stringify(row.stepsJson),
    JSON.stringify(row.requiredFactKeys),
    JSON.stringify(row.requiredDocTypes),
    JSON.stringify(row.uiModuleIds),
    JSON.stringify(row.notificationGuardFlags),
    row.actionMapId,
    row.exceptionCode,
    JSON.stringify(row.escalationJson),
    JSON.stringify(row.metricsKeys),
    row.activeFlag,
    row.reviewerStatus,
    row.publishBundleId,
    JSON.stringify(row.metadata)
  ];
  const result = await pool.query(sql, values);
  return { table: 'task_template', recordId: `task_template:${(result.rows[0] || {}).task_template_id || row.taskTemplateId}` };
}

async function upsertRuleSet(pool, payload) {
  const row = normalizeRuleSetRow(payload);
  const sql = `
INSERT INTO rule_set (
  rule_id,
  canonical_key,
  rule_code,
  rule_scope,
  expr_lang,
  trigger_expr,
  expr_body,
  output_payload,
  priority,
  test_fixture,
  effective_from,
  effective_to,
  reviewer_status,
  active_flag,
  publish_bundle_id,
  metadata,
  updated_at
)
VALUES (
  $1::uuid,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10::jsonb,$11,$12,$13::reviewer_status,$14,$15::uuid,$16::jsonb,NOW()
)
ON CONFLICT (rule_id) DO UPDATE
SET
  canonical_key = EXCLUDED.canonical_key,
  rule_code = EXCLUDED.rule_code,
  rule_scope = EXCLUDED.rule_scope,
  expr_lang = EXCLUDED.expr_lang,
  trigger_expr = EXCLUDED.trigger_expr,
  expr_body = EXCLUDED.expr_body,
  output_payload = EXCLUDED.output_payload,
  priority = EXCLUDED.priority,
  test_fixture = EXCLUDED.test_fixture,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  reviewer_status = EXCLUDED.reviewer_status,
  active_flag = EXCLUDED.active_flag,
  publish_bundle_id = EXCLUDED.publish_bundle_id,
  metadata = EXCLUDED.metadata,
  updated_at = NOW()
RETURNING rule_id
`.trim();
  const values = [
    row.ruleId,
    row.canonicalKey,
    row.ruleCode,
    row.ruleScope,
    row.exprLang,
    row.triggerExpr,
    JSON.stringify(row.exprBody),
    JSON.stringify(row.outputPayload),
    row.priority,
    JSON.stringify(row.testFixture),
    row.effectiveFrom,
    row.effectiveTo,
    row.reviewerStatus,
    row.activeFlag,
    row.publishBundleId,
    JSON.stringify(row.metadata)
  ];
  const result = await pool.query(sql, values);
  return { table: 'rule_set', recordId: `rule_set:${(result.rows[0] || {}).rule_id || row.ruleId}` };
}

async function upsertGeneratedView(pool, event) {
  const materialized = materializeGeneratedViewRecordFromEvent(event);
  if (!materialized || materialized.skipped === true) {
    return {
      table: 'generated_view',
      status: 'skipped',
      reason: materialized && materialized.reason ? materialized.reason : 'generated_view_payload_missing'
    };
  }
  const row = materialized.row;
  const sql = `
INSERT INTO generated_view (
  view_id,
  canonical_key,
  view_type,
  view_key,
  locale,
  country_code,
  scope_key,
  object_subtype,
  title,
  title_short,
  summary_md,
  body_md,
  faq_question,
  faq_answer_short,
  city_pack_module_key,
  rich_menu_action_id,
  vendor_code,
  vendor_slot_policy,
  notification_guard_flags,
  ui_module_ids,
  authority_floor,
  binding_level,
  confidence_score,
  freshness_sla_days,
  render_payload,
  from_object_ids,
  from_claim_ids,
  from_task_codes,
  from_signal_ids,
  derivation_method,
  prompt_version,
  model_name,
  reviewer_status,
  active_flag,
  stale_flag,
  effective_from,
  effective_to,
  metadata,
  updated_at
)
VALUES (
  $1::uuid,$2,$3::view_type_enum,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19::jsonb,$20::jsonb,
  $21::authority_tier,$22::binding_level,$23,$24,$25::jsonb,$26::jsonb,$27::jsonb,$28::jsonb,$29::jsonb,$30,$31,$32,$33::reviewer_status,$34,$35,$36,$37,$38::jsonb,NOW()
)
ON CONFLICT (view_id) DO UPDATE
SET
  canonical_key = EXCLUDED.canonical_key,
  view_type = EXCLUDED.view_type,
  view_key = EXCLUDED.view_key,
  locale = EXCLUDED.locale,
  country_code = EXCLUDED.country_code,
  scope_key = EXCLUDED.scope_key,
  object_subtype = EXCLUDED.object_subtype,
  title = EXCLUDED.title,
  title_short = EXCLUDED.title_short,
  summary_md = EXCLUDED.summary_md,
  body_md = EXCLUDED.body_md,
  faq_question = EXCLUDED.faq_question,
  faq_answer_short = EXCLUDED.faq_answer_short,
  city_pack_module_key = EXCLUDED.city_pack_module_key,
  rich_menu_action_id = EXCLUDED.rich_menu_action_id,
  vendor_code = EXCLUDED.vendor_code,
  vendor_slot_policy = EXCLUDED.vendor_slot_policy,
  notification_guard_flags = EXCLUDED.notification_guard_flags,
  ui_module_ids = EXCLUDED.ui_module_ids,
  authority_floor = EXCLUDED.authority_floor,
  binding_level = EXCLUDED.binding_level,
  confidence_score = EXCLUDED.confidence_score,
  freshness_sla_days = EXCLUDED.freshness_sla_days,
  render_payload = EXCLUDED.render_payload,
  from_object_ids = EXCLUDED.from_object_ids,
  from_claim_ids = EXCLUDED.from_claim_ids,
  from_task_codes = EXCLUDED.from_task_codes,
  from_signal_ids = EXCLUDED.from_signal_ids,
  derivation_method = EXCLUDED.derivation_method,
  prompt_version = EXCLUDED.prompt_version,
  model_name = EXCLUDED.model_name,
  reviewer_status = EXCLUDED.reviewer_status,
  active_flag = EXCLUDED.active_flag,
  stale_flag = EXCLUDED.stale_flag,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  metadata = EXCLUDED.metadata,
  updated_at = NOW()
RETURNING view_id
`.trim();
  const values = [
    row.viewId,
    row.canonicalKey,
    row.viewType,
    row.viewKey,
    row.locale,
    row.countryCode,
    row.scopeKey,
    row.objectSubtype,
    row.title,
    row.titleShort,
    row.summaryMd,
    row.bodyMd,
    row.faqQuestion,
    row.faqAnswerShort,
    row.cityPackModuleKey,
    row.richMenuActionId,
    row.vendorCode,
    JSON.stringify(row.vendorSlotPolicy || {}),
    JSON.stringify(Array.isArray(row.notificationGuardFlags) ? row.notificationGuardFlags : []),
    JSON.stringify(Array.isArray(row.uiModuleIds) ? row.uiModuleIds : []),
    row.authorityFloor,
    row.bindingLevel,
    row.confidenceScore,
    row.freshnessSlaDays,
    JSON.stringify(row.renderPayload || {}),
    JSON.stringify(Array.isArray(row.fromObjectIds) ? row.fromObjectIds : []),
    JSON.stringify(Array.isArray(row.fromClaimIds) ? row.fromClaimIds : []),
    JSON.stringify(Array.isArray(row.fromTaskCodes) ? row.fromTaskCodes : []),
    JSON.stringify(Array.isArray(row.fromSignalIds) ? row.fromSignalIds : []),
    row.derivationMethod,
    row.promptVersion,
    row.modelName,
    row.reviewerStatus,
    row.activeFlag,
    row.staleFlag,
    row.effectiveFrom,
    row.effectiveTo,
    JSON.stringify(row.metadata || {})
  ];
  const result = await pool.query(sql, values);
  return { table: 'generated_view', recordId: `generated_view:${(result.rows[0] || {}).view_id || row.viewId}` };
}

async function materializeTypedTable(pool, tableName, canonicalPayload, event) {
  if (tableName === 'source_registry') return upsertSourceRegistry(pool, canonicalPayload.sourceRegistry);
  if (tableName === 'source_snapshot') return upsertSourceSnapshot(pool, canonicalPayload.sourceSnapshot);
  if (tableName === 'evidence_claim') return upsertEvidenceClaim(pool, canonicalPayload.evidenceClaim);
  if (tableName === 'knowledge_object') return upsertKnowledgeObject(pool, canonicalPayload.knowledgeObject);
  if (tableName === 'task_template') return upsertTaskTemplate(pool, canonicalPayload.taskTemplate);
  if (tableName === 'rule_set') return upsertRuleSet(pool, canonicalPayload.ruleSet);
  if (tableName === 'generated_view') return upsertGeneratedView(pool, event);
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
      const result = await materializeTypedTable(pool, tableName, canonicalPayload, event);
      if (result && result.recordId) {
        tables.push({
          table: tableName,
          status: 'materialized',
          recordId: result.recordId
        });
      } else if (result && result.status === 'skipped') {
        tables.push({
          table: tableName,
          status: 'skipped',
          reason: result.reason || 'payload_missing'
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
