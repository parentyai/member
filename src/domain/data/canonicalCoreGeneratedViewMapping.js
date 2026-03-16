'use strict';

const crypto = require('crypto');

const ALLOWED_VIEW_TYPES = new Set(['faq', 'atoz', 'city_pack', 'rich_menu', 'vendor_card', 'bulletin']);
const DEFAULT_CITY_PACK_FRESHNESS_SLA_DAYS = 120;

function normalizeText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeLocale(value, fallback) {
  const locale = normalizeText(value, fallback || 'ja');
  return locale ? locale.toLowerCase() : (fallback || 'ja');
}

function normalizeCountryCode(value) {
  const countryCode = normalizeText(value, null);
  if (!countryCode) return null;
  return countryCode.toUpperCase();
}

function normalizeScopeKey(value) {
  const scopeKey = normalizeText(value, null);
  return scopeKey || null;
}

function normalizeInteger(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const next = Math.floor(parsed);
  if (Number.isFinite(min) && next < min) return fallback;
  if (Number.isFinite(max) && next > max) return fallback;
  return next;
}

function pickRegionKeyFromTargetingRules(rules) {
  const rows = normalizeArray(rules);
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const field = normalizeText(row.field, '').toLowerCase();
    if (field !== 'regionkey') continue;
    const effect = normalizeText(row.effect, 'include').toLowerCase();
    if (effect !== 'include') continue;
    if (typeof row.value === 'string' && row.value.trim()) return row.value.trim();
    if (Array.isArray(row.value)) {
      const first = row.value.find((item) => typeof item === 'string' && item.trim());
      if (first) return first.trim();
    }
  }
  return null;
}

function resolveCityPackCountryCode(cityPack) {
  const payload = cityPack && typeof cityPack === 'object' ? cityPack : {};
  const metadata = normalizeMetadata(payload.metadata);
  return normalizeCountryCode(metadata.countryCode || metadata.country_code || metadata.country);
}

function resolveCityPackScopeKey(cityPack) {
  const payload = cityPack && typeof cityPack === 'object' ? cityPack : {};
  const metadata = normalizeMetadata(payload.metadata);
  return (
    normalizeScopeKey(metadata.scopeKey)
    || normalizeScopeKey(metadata.scope_key)
    || normalizeScopeKey(metadata.regionKey)
    || normalizeScopeKey(metadata.region_key)
    || normalizeScopeKey(pickRegionKeyFromTargetingRules(payload.targetingRules))
    || 'GLOBAL'
  );
}

function resolveCityPackJurisdiction(cityPack) {
  const payload = cityPack && typeof cityPack === 'object' ? cityPack : {};
  const metadata = normalizeMetadata(payload.metadata);
  return (
    normalizeScopeKey(metadata.regionKey)
    || normalizeScopeKey(metadata.region_key)
    || normalizeScopeKey(pickRegionKeyFromTargetingRules(payload.targetingRules))
    || null
  );
}

function mapEnvelopeAuthorityTierToFloor(value) {
  const authority = normalizeText(value, 'UNKNOWN').toUpperCase();
  if (authority.startsWith('T0')) return 'T0';
  if (authority.startsWith('T1')) return 'T1';
  if (authority.startsWith('T2')) return 'T2';
  if (authority.startsWith('T3')) return 'T3';
  return 'T4';
}

function mapEnvelopeBindingLevel(value) {
  const bindingLevel = normalizeText(value, 'UNKNOWN').toUpperCase();
  if (bindingLevel === 'MANDATORY') return 'mandatory';
  if (bindingLevel === 'POLICY') return 'policy_bound';
  if (bindingLevel === 'RECOMMENDED') return 'recommended';
  if (bindingLevel === 'REFERENCE') return 'informative';
  return 'anecdotal';
}

function stableUuidFromText(value) {
  const hex = crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex').slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-');
}

function buildCityPackGeneratedViewCanonicalPayload(cityPackId, cityPack, recordEnvelope) {
  const payload = cityPack && typeof cityPack === 'object' ? cityPack : {};
  const metadata = normalizeMetadata(payload.metadata);
  const locale = normalizeLocale(payload.language, 'ja');
  const countryCode = resolveCityPackCountryCode(payload);
  const scopeKey = resolveCityPackScopeKey(payload);
  const title = normalizeText(payload.name, cityPackId);
  const summaryMd = normalizeText(payload.description, null);
  const modules = normalizeArray(payload.modules).filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim().toLowerCase());
  const record = recordEnvelope && typeof recordEnvelope === 'object' ? recordEnvelope : {};
  const freshnessSlaDays = normalizeInteger(
    metadata.freshnessSlaDays || metadata.freshness_sla_days,
    DEFAULT_CITY_PACK_FRESHNESS_SLA_DAYS,
    1,
    3650
  );
  const effectiveTo = record.effective_to || null;
  const effectiveToMs = effectiveTo ? Date.parse(effectiveTo) : Number.NaN;

  return {
    viewType: 'city_pack',
    canonicalKey: `city_pack:${cityPackId}:${locale}`,
    viewKey: `city_pack:${cityPackId}`,
    locale,
    countryCode,
    scopeKey,
    objectSubtype: normalizeText(payload.packClass, 'regional'),
    title,
    titleShort: title.slice(0, 80),
    summaryMd,
    bodyMd: null,
    cityPackModuleKey: modules.length === 1 ? modules[0] : null,
    authorityFloor: mapEnvelopeAuthorityTierToFloor(record.authority_tier),
    bindingLevel: mapEnvelopeBindingLevel(record.binding_level),
    confidenceScore: 1,
    freshnessSlaDays,
    reviewerStatus: 'draft',
    activeFlag: normalizeText(payload.status, 'draft') === 'active',
    staleFlag: Number.isFinite(effectiveToMs) ? effectiveToMs < Date.now() : false,
    renderPayload: {
      cityPackId,
      packClass: normalizeText(payload.packClass, 'regional'),
      language: locale,
      status: normalizeText(payload.status, 'draft'),
      modules,
      description: summaryMd,
      slotSchemaVersion: normalizeText(payload.slotSchemaVersion, null),
      sourceRefs: normalizeArray(payload.sourceRefs).filter((item) => typeof item === 'string' && item.trim()),
      nationwidePolicy: normalizeText(payload.nationwidePolicy, null)
    },
    fromObjectIds: [cityPackId],
    fromClaimIds: [],
    fromTaskCodes: [],
    fromSignalIds: [],
    derivationMethod: 'firestore_sidecar',
    promptVersion: null,
    modelName: null,
    metadata: {
      sourceCollection: 'city_packs',
      regionKey: resolveCityPackJurisdiction(payload),
      countryCodeSource: countryCode ? 'metadata' : 'missing',
      scopeKeySource: scopeKey === 'GLOBAL' ? 'default' : 'record'
    }
  };
}

function buildCityPackGeneratedViewSourceLinks(cityPack) {
  const payload = cityPack && typeof cityPack === 'object' ? cityPack : {};
  return normalizeArray(payload.sourceRefs)
    .filter((item) => typeof item === 'string' && item.trim())
    .map((sourceRefId, index) => ({
      sourceId: sourceRefId.trim(),
      snapshotRef: `source_ref:${sourceRefId.trim()}`,
      linkRole: 'supports',
      primary: index === 0
    }));
}

function materializeGeneratedViewRecordFromEvent(event) {
  const payload = event && typeof event === 'object' ? event : {};
  if (payload.objectType !== 'generated_view') {
    return { skipped: true, reason: 'unsupported_object_type' };
  }
  const hints = payload.materializationHints && typeof payload.materializationHints === 'object'
    ? payload.materializationHints
    : null;
  const targetTables = hints && Array.isArray(hints.targetTables) ? hints.targetTables : [];
  if (!targetTables.includes('generated_view')) {
    return { skipped: true, reason: 'generated_view_not_requested' };
  }
  const canonicalPayload = payload.canonicalPayload && typeof payload.canonicalPayload === 'object'
    ? payload.canonicalPayload
    : null;
  if (!canonicalPayload) {
    return { skipped: true, reason: 'canonical_payload_missing' };
  }

  const viewType = normalizeText(canonicalPayload.viewType, '').toLowerCase();
  if (!ALLOWED_VIEW_TYPES.has(viewType)) {
    return { skipped: true, reason: 'invalid_view_type' };
  }
  const canonicalKey = normalizeText(canonicalPayload.canonicalKey, null);
  const viewKey = normalizeText(canonicalPayload.viewKey, null);
  const locale = normalizeText(canonicalPayload.locale, null);
  const countryCode = normalizeCountryCode(canonicalPayload.countryCode);
  const title = normalizeText(canonicalPayload.title, null);
  if (!canonicalKey) return { skipped: true, reason: 'canonical_key_missing' };
  if (!viewKey) return { skipped: true, reason: 'view_key_missing' };
  if (!locale) return { skipped: true, reason: 'locale_missing' };
  if (!countryCode) return { skipped: true, reason: 'country_code_missing' };
  if (!title) return { skipped: true, reason: 'title_missing' };

  const scopeKey = normalizeScopeKey(canonicalPayload.scopeKey) || 'GLOBAL';
  const renderPayload = canonicalPayload.renderPayload && typeof canonicalPayload.renderPayload === 'object'
    ? canonicalPayload.renderPayload
    : {};
  const row = {
    viewId: stableUuidFromText(`${canonicalKey}::${viewType}::${locale}`),
    canonicalKey,
    viewType,
    viewKey,
    locale,
    countryCode,
    scopeKey,
    objectSubtype: normalizeText(canonicalPayload.objectSubtype, null),
    title,
    titleShort: normalizeText(canonicalPayload.titleShort, null),
    summaryMd: normalizeText(canonicalPayload.summaryMd, null),
    bodyMd: normalizeText(canonicalPayload.bodyMd, null),
    faqQuestion: normalizeText(canonicalPayload.faqQuestion, null),
    faqAnswerShort: normalizeText(canonicalPayload.faqAnswerShort, null),
    cityPackModuleKey: normalizeText(canonicalPayload.cityPackModuleKey, null),
    richMenuActionId: normalizeText(canonicalPayload.richMenuActionId, null),
    vendorCode: normalizeText(canonicalPayload.vendorCode, null),
    vendorSlotPolicy: canonicalPayload.vendorSlotPolicy && typeof canonicalPayload.vendorSlotPolicy === 'object'
      ? canonicalPayload.vendorSlotPolicy
      : {},
    notificationGuardFlags: normalizeArray(canonicalPayload.notificationGuardFlags),
    uiModuleIds: normalizeArray(renderPayload.modules || canonicalPayload.uiModuleIds),
    authorityFloor: normalizeText(canonicalPayload.authorityFloor, 'T4'),
    bindingLevel: normalizeText(canonicalPayload.bindingLevel, 'informative'),
    confidenceScore: Number.isFinite(Number(canonicalPayload.confidenceScore))
      ? Number(canonicalPayload.confidenceScore)
      : 1,
    freshnessSlaDays: normalizeInteger(canonicalPayload.freshnessSlaDays, DEFAULT_CITY_PACK_FRESHNESS_SLA_DAYS, 1, 3650),
    renderPayload,
    fromObjectIds: normalizeArray(canonicalPayload.fromObjectIds),
    fromClaimIds: normalizeArray(canonicalPayload.fromClaimIds),
    fromTaskCodes: normalizeArray(canonicalPayload.fromTaskCodes),
    fromSignalIds: normalizeArray(canonicalPayload.fromSignalIds),
    derivationMethod: normalizeText(canonicalPayload.derivationMethod, 'firestore_sidecar'),
    promptVersion: normalizeText(canonicalPayload.promptVersion, null),
    modelName: normalizeText(canonicalPayload.modelName, null),
    reviewerStatus: normalizeText(canonicalPayload.reviewerStatus, 'draft'),
    activeFlag: canonicalPayload.activeFlag === true,
    staleFlag: canonicalPayload.staleFlag === true,
    effectiveFrom: payload.effectiveFrom || null,
    effectiveTo: payload.effectiveTo || null,
    metadata: canonicalPayload.metadata && typeof canonicalPayload.metadata === 'object'
      ? canonicalPayload.metadata
      : {}
  };

  return {
    skipped: false,
    targetTable: 'generated_view',
    row
  };
}

module.exports = {
  DEFAULT_CITY_PACK_FRESHNESS_SLA_DAYS,
  buildCityPackGeneratedViewCanonicalPayload,
  buildCityPackGeneratedViewSourceLinks,
  materializeGeneratedViewRecordFromEvent,
  resolveCityPackCountryCode,
  resolveCityPackJurisdiction,
  resolveCityPackScopeKey
};
