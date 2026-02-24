'use strict';

const { validateSchema, containsDirectUrl } = require('../../llm/validateSchema');
const { ABSTRACT_ACTIONS } = require('../../llm/schemas');
const { validateWarnLinkBlock } = require('../../domain/validators');
const defaultLinkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function guardFaqOutput(payload, options) {
  const candidate = isPlainObject(payload) ? payload : null;
  if (!candidate) return { ok: false, blockedReason: 'invalid_schema' };

  const citations = Array.isArray(candidate.citations) ? candidate.citations : [];
  if (options.requireCitations && citations.length === 0) {
    return { ok: false, blockedReason: 'citations_required' };
  }

  if (containsDirectUrl(candidate.answer)) {
    return { ok: false, blockedReason: 'direct_url_forbidden' };
  }

  const allowedSourceIds = new Set(Array.isArray(options.allowedSourceIds) ? options.allowedSourceIds : []);
  const repo = options.linkRegistryRepo || defaultLinkRegistryRepo;

  for (const citation of citations) {
    if (!citation || citation.sourceType !== 'link_registry' || typeof citation.sourceId !== 'string' || citation.sourceId.trim().length === 0) {
      return { ok: false, blockedReason: 'invalid_citation' };
    }
    const sourceId = citation.sourceId.trim();
    if (allowedSourceIds.size > 0 && !allowedSourceIds.has(sourceId)) {
      return { ok: false, blockedReason: 'invalid_citation_source' };
    }

    if (options.checkWarnLinks && repo && typeof repo.getLink === 'function') {
      const entry = await repo.getLink(sourceId);
      if (!entry) return { ok: false, blockedReason: 'missing_link_registry' };
      try {
        validateWarnLinkBlock(entry);
      } catch (_err) {
        return { ok: false, blockedReason: 'warn_link_blocked' };
      }
    }
  }

  return { ok: true };
}

function guardNextActionOutput(payload) {
  const candidate = isPlainObject(payload) ? payload : null;
  if (!candidate || !Array.isArray(candidate.candidates)) {
    return { ok: false, blockedReason: 'invalid_schema' };
  }
  for (const item of candidate.candidates) {
    if (!item || !ABSTRACT_ACTIONS.includes(item.action)) {
      return { ok: false, blockedReason: 'invalid_action' };
    }
  }
  return { ok: true };
}

function guardPaidAssistantOutput(payload) {
  const candidate = isPlainObject(payload) ? payload : null;
  if (!candidate) return { ok: false, blockedReason: 'template_violation' };
  const evidenceKeys = Array.isArray(candidate.evidenceKeys) ? candidate.evidenceKeys : [];
  if (!evidenceKeys.length) return { ok: false, blockedReason: 'citation_missing' };
  const allStrings = evidenceKeys.every((item) => typeof item === 'string' && item.trim().length > 0);
  if (!allStrings) return { ok: false, blockedReason: 'citation_missing' };
  return { ok: true };
}

async function guardLlmOutput(params, deps) {
  const payload = params || {};
  const purpose = payload.purpose;
  const schemaId = payload.schemaId;
  const output = payload.output;
  const schemaCheck = validateSchema(schemaId, output);
  if (!schemaCheck.ok) {
    const schemaErrors = Array.isArray(schemaCheck.errors) ? schemaCheck.errors : [];
    if (purpose === 'faq' && schemaErrors.includes('direct_url_detected')) {
      return { ok: false, blockedReason: 'direct_url_forbidden', schemaErrors };
    }
    if (purpose === 'faq' && schemaErrors.some((item) => typeof item === 'string' && item.startsWith('citations['))) {
      return { ok: false, blockedReason: 'invalid_citation', schemaErrors };
    }
    if (purpose === 'next_actions' && schemaErrors.some((item) => typeof item === 'string' && item.includes('.action invalid'))) {
      return { ok: false, blockedReason: 'invalid_action', schemaErrors };
    }
    if (purpose === 'paid_assistant' && schemaErrors.some((item) => typeof item === 'string' && item.includes('evidenceKeys'))) {
      return { ok: false, blockedReason: 'citation_missing', schemaErrors };
    }
    if (purpose === 'paid_assistant') {
      return { ok: false, blockedReason: 'template_violation', schemaErrors };
    }
    return { ok: false, blockedReason: 'invalid_schema', schemaErrors };
  }

  if (purpose === 'faq') {
    const result = await guardFaqOutput(output, {
      requireCitations: payload.requireCitations !== false,
      allowedSourceIds: payload.allowedSourceIds,
      checkWarnLinks: payload.checkWarnLinks === true,
      linkRegistryRepo: deps && deps.linkRegistryRepo ? deps.linkRegistryRepo : null
    });
    if (!result.ok) return result;
  }

  if (purpose === 'next_actions') {
    const result = guardNextActionOutput(output);
    if (!result.ok) return result;
  }

  if (purpose === 'paid_assistant') {
    const result = guardPaidAssistantOutput(output);
    if (!result.ok) return result;
    const allowedEvidenceKeys = Array.isArray(payload.allowedEvidenceKeys) ? payload.allowedEvidenceKeys : [];
    if (allowedEvidenceKeys.length > 0) {
      const allowed = new Set(allowedEvidenceKeys.map((item) => String(item || '').trim()).filter(Boolean));
      const evidenceKeys = output && Array.isArray(output.evidenceKeys) ? output.evidenceKeys : [];
      const allIncluded = evidenceKeys.every((item) => allowed.has(String(item || '').trim()));
      if (!allIncluded) return { ok: false, blockedReason: 'citation_missing' };
    }
  }

  return { ok: true, schemaErrors: null };
}

module.exports = {
  guardLlmOutput
};
