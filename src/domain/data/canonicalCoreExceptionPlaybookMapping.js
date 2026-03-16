'use strict';

const {
  normalizeText,
  normalizeBoolean,
  normalizeStringArray,
  normalizeObject,
  buildDeterministicUuid,
  mapAuthorityTierToCanonical,
  resolveScopeKey,
  resolveReviewerStatus
} = require('./canonicalCoreCompatMapping');

const ALLOWED_SEVERITY = new Set(['low', 'medium', 'high', 'critical']);

function normalizeSeverity(value, fallback) {
  const normalized = normalizeText(value, fallback || 'medium');
  if (!normalized) return fallback || 'medium';
  const lowered = normalized.toLowerCase();
  return ALLOWED_SEVERITY.has(lowered) ? lowered : (fallback || 'medium');
}

function normalizeStringList(value) {
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return normalizeStringArray(value);
}

function normalizeEscalationContacts(value, template) {
  const payload = normalizeObject(value, {});
  const templatePayload = template && typeof template === 'object' ? template : {};
  const linkRegistryId = normalizeText(payload.linkRegistryId, normalizeText(templatePayload.linkRegistryId, null));
  const ctaText = normalizeText(payload.ctaText, normalizeText(templatePayload.ctaText, null));
  const out = Object.assign({}, payload);
  if (linkRegistryId) out.linkRegistryId = linkRegistryId;
  if (ctaText) out.ctaText = ctaText;
  return out;
}

function normalizeExceptionPlaybookMetadata(value, params) {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  if (!payload) return null;
  const options = params && typeof params === 'object' ? params : {};
  const template = options.template && typeof options.template === 'object' ? options.template : {};
  const status = normalizeText(options.status, normalizeText(template.status, 'draft')).toLowerCase();
  const lifecycleState = status === 'active' ? 'approved' : 'candidate';
  const exceptionCode = normalizeText(payload.exceptionCode, normalizeText(template.key, null));
  const title = normalizeText(
    payload.title,
    normalizeText(template.title, normalizeText(template.text, exceptionCode || 'exception-playbook'))
  );
  const countryCode = normalizeText(payload.countryCode, normalizeText(payload.country_code, null));
  const summaryMd = normalizeText(
    payload.summaryMd,
    normalizeText(template.title, normalizeText(template.text, null))
  );
  const bodyMd = normalizeText(
    payload.bodyMd,
    normalizeText(template.body, normalizeText(template.text, null))
  );
  const metadata = normalizeObject(payload.metadata, {});
  const normalized = {
    exceptionId: normalizeText(payload.exceptionId, buildDeterministicUuid(`exception_playbook:${exceptionCode || template.key || 'template'}`)),
    canonicalKey: normalizeText(payload.canonicalKey, exceptionCode ? `exception_playbook:${exceptionCode}` : null),
    exceptionCode,
    title,
    domain: normalizeText(payload.domain, null),
    topic: normalizeText(payload.topic, null),
    countryCode: countryCode ? countryCode.toUpperCase() : null,
    scopeKey: resolveScopeKey(payload.scopeKey || payload.scope_key, 'GLOBAL'),
    audienceScope: normalizeStringList(payload.audienceScope || payload.audience_scope),
    householdScope: normalizeStringList(payload.householdScope || payload.household_scope),
    visaScope: normalizeStringList(payload.visaScope || payload.visa_scope),
    severity: normalizeSeverity(payload.severity, 'medium'),
    symptomPatterns: normalizeStringList(payload.symptomPatterns || payload.symptomPattern || payload.symptoms),
    detectionExpr: normalizeText(payload.detectionExpr, normalizeText(payload.detectionRule, null)),
    summaryMd,
    bodyMd,
    fallbackSteps: normalizeStringList(payload.fallbackSteps),
    escalationContacts: normalizeEscalationContacts(payload.escalationContacts, template),
    authorityFloor: mapAuthorityTierToCanonical(payload.authorityFloor || payload.authority_floor, 'T3'),
    reviewerStatus: resolveReviewerStatus({
      status: normalizeText(payload.reviewerStatus, status),
      lifecycleState
    }, status === 'active' ? 'approved' : 'draft'),
    activeFlag: status === 'active',
    staleFlag: status === 'inactive',
    publishBundleId: normalizeText(payload.publishBundleId, null),
    metadata: Object.assign({}, metadata, {
      linkedTaskTemplates: normalizeStringList(payload.linkedTaskTemplates),
      likelyCauses: normalizeStringList(payload.likelyCauses),
      requiredEvidence: normalizeStringList(payload.requiredEvidence),
      humanReviewRequired: normalizeBoolean(payload.humanReviewRequired, false) === true,
      notificationCategory: normalizeText(template.notificationCategory, null),
      templateKey: normalizeText(template.key, null),
      templateId: normalizeText(options.templateId, null)
    })
  };
  return normalized;
}

function buildExceptionPlaybookCanonicalPayload(templateId, templateRecord, recordEnvelope) {
  const template = templateRecord && typeof templateRecord === 'object' ? templateRecord : {};
  const metadata = normalizeExceptionPlaybookMetadata(template.exceptionPlaybook, {
    template,
    templateId,
    status: template.status
  });
  if (!metadata) return null;
  return {
    exceptionPlaybook: Object.assign({}, metadata, {
      metadata: Object.assign({}, metadata.metadata, {
        recordEnvelope: recordEnvelope && typeof recordEnvelope === 'object' ? recordEnvelope : {}
      })
    })
  };
}

function buildExceptionPlaybookSourceLinks(templateId, templateRecord) {
  const template = templateRecord && typeof templateRecord === 'object' ? templateRecord : {};
  const links = [{
    sourceId: null,
    snapshotRef: templateId ? `notification_templates:${templateId}` : null,
    linkRole: 'runtime_authority',
    primary: true
  }];
  const linkRegistryId = normalizeText(template.linkRegistryId, null);
  if (linkRegistryId) {
    links.push({
      sourceId: null,
      snapshotRef: `link_registry:${linkRegistryId}`,
      linkRole: 'escalation_entrypoint',
      primary: false
    });
  }
  return links.filter((row) => row.snapshotRef);
}

function materializeExceptionPlaybookRecordFromEvent(event) {
  const payload = event && typeof event === 'object' ? event : {};
  if (payload.objectType !== 'exception_playbook') {
    return { skipped: true, reason: 'unsupported_object_type' };
  }
  const hints = payload.materializationHints && typeof payload.materializationHints === 'object'
    ? payload.materializationHints
    : null;
  const targetTables = hints && Array.isArray(hints.targetTables) ? hints.targetTables : [];
  if (!targetTables.includes('exception_playbook')) {
    return { skipped: true, reason: 'exception_playbook_not_requested' };
  }
  const canonicalPayload = payload.canonicalPayload && typeof payload.canonicalPayload === 'object'
    ? payload.canonicalPayload
    : null;
  const record = canonicalPayload && canonicalPayload.exceptionPlaybook && typeof canonicalPayload.exceptionPlaybook === 'object'
    ? canonicalPayload.exceptionPlaybook
    : null;
  if (!record) return { skipped: true, reason: 'exception_playbook_payload_missing' };

  if (!normalizeText(record.canonicalKey, null)) return { skipped: true, reason: 'canonical_key_missing' };
  if (!normalizeText(record.exceptionCode, null)) return { skipped: true, reason: 'exception_code_missing' };
  if (!normalizeText(record.title, null)) return { skipped: true, reason: 'title_missing' };
  if (!normalizeText(record.domain, null)) return { skipped: true, reason: 'domain_missing' };
  if (!normalizeText(record.topic, null)) return { skipped: true, reason: 'topic_missing' };
  if (!normalizeText(record.countryCode, null)) return { skipped: true, reason: 'country_code_missing' };
  if (normalizeStringList(record.symptomPatterns).length < 1) return { skipped: true, reason: 'symptom_patterns_missing' };
  if (normalizeStringList(record.fallbackSteps).length < 1) return { skipped: true, reason: 'fallback_steps_missing' };

  const row = normalizeExceptionPlaybookMetadata(record, {
    template: {
      key: record.exceptionCode,
      title: record.title,
      body: record.bodyMd,
      text: record.summaryMd,
      status: record.activeFlag ? 'active' : 'draft'
    },
    templateId: record.metadata && typeof record.metadata === 'object' ? record.metadata.templateId : null,
    status: record.activeFlag ? 'active' : 'draft'
  });
  return { skipped: false, row };
}

module.exports = {
  normalizeExceptionPlaybookMetadata,
  buildExceptionPlaybookCanonicalPayload,
  buildExceptionPlaybookSourceLinks,
  materializeExceptionPlaybookRecordFromEvent
};
