'use strict';

const { validateSchema, containsDirectUrl } = require('../../llm/validateSchema');
const { ABSTRACT_ACTIONS } = require('../../llm/schemas');
const { validateWarnLinkBlock } = require('../../domain/validators');
const defaultLinkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function resolveOutputConstraints(input) {
  const payload = isPlainObject(input) ? input : {};
  const parseIntInRange = (value, fallback, min, max) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    const floored = Math.floor(num);
    if (floored < min || floored > max) return fallback;
    return floored;
  };
  const parseBool = (value, fallback) => {
    if (value === true || value === false) return value;
    return fallback;
  };
  return {
    maxNextActions: parseIntInRange(payload.max_next_actions, 3, 0, 3),
    maxGaps: parseIntInRange(payload.max_gaps, 5, 0, 10),
    maxRisks: parseIntInRange(payload.max_risks, 3, 0, 10),
    requireEvidence: parseBool(payload.require_evidence, true),
    forbidDirectUrl: parseBool(payload.forbid_direct_url, true)
  };
}

function resolveForbiddenDomains(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  value.forEach((item) => {
    if (typeof item !== 'string') return;
    const normalized = item.trim().toLowerCase();
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

async function guardFaqOutput(payload, options) {
  const candidate = isPlainObject(payload) ? payload : null;
  if (!candidate) return { ok: false, blockedReason: 'invalid_schema' };

  const citations = Array.isArray(candidate.citations) ? candidate.citations : [];
  if (options.requireCitations && citations.length === 0) {
    return { ok: false, blockedReason: 'citations_required' };
  }

  if (options.forbidDirectUrl !== false && containsDirectUrl(candidate.answer)) {
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

function guardPaidAssistantOutput(payload, options) {
  const candidate = isPlainObject(payload) ? payload : null;
  if (!candidate) return { ok: false, blockedReason: 'template_violation' };
  const constraints = resolveOutputConstraints(options && options.outputConstraints);
  if (typeof candidate.situation !== 'string' || candidate.situation.trim().length === 0) {
    return { ok: false, blockedReason: 'template_violation' };
  }
  const gaps = Array.isArray(candidate.gaps) ? candidate.gaps : [];
  const risks = Array.isArray(candidate.risks) ? candidate.risks : [];
  const nextActions = Array.isArray(candidate.nextActions) ? candidate.nextActions : [];
  if (
    gaps.length > constraints.maxGaps
    || risks.length > constraints.maxRisks
    || nextActions.length > constraints.maxNextActions
  ) {
    return { ok: false, blockedReason: 'section_limit_exceeded' };
  }
  const evidenceKeys = Array.isArray(candidate.evidenceKeys) ? candidate.evidenceKeys : [];
  if (constraints.requireEvidence) {
    if (!evidenceKeys.length) return { ok: false, blockedReason: 'citation_missing' };
    const allStrings = evidenceKeys.every((item) => typeof item === 'string' && item.trim().length > 0);
    if (!allStrings) return { ok: false, blockedReason: 'citation_missing' };
  }
  const invalidActionLine = nextActions.some((item) => {
    if (typeof item !== 'string' || item.trim().length === 0) return true;
    return !/根拠\s*[:：]/.test(item);
  });
  if (constraints.requireEvidence && invalidActionLine) return { ok: false, blockedReason: 'citation_missing' };
  if (constraints.forbidDirectUrl) {
    const allText = [
      candidate.situation,
      ...(Array.isArray(candidate.gaps) ? candidate.gaps : []),
      ...(Array.isArray(candidate.risks) ? candidate.risks : []),
      ...(Array.isArray(candidate.nextActions) ? candidate.nextActions : [])
    ].filter((item) => typeof item === 'string');
    const hasDirectUrl = allText.some((item) => containsDirectUrl(item));
    if (hasDirectUrl) return { ok: false, blockedReason: 'direct_url_forbidden' };
  }
  return { ok: true };
}

async function guardLlmOutput(params, deps) {
  const payload = params || {};
  const purpose = payload.purpose;
  const schemaId = payload.schemaId;
  const output = payload.output;
  const policyOutputConstraints = isPlainObject(payload.policy)
    ? payload.policy.output_constraints
    : null;
  const outputConstraints = resolveOutputConstraints(payload.outputConstraints || policyOutputConstraints);
  const forbiddenDomains = resolveForbiddenDomains(
    payload.forbiddenDomains || (isPlainObject(payload.policy) ? payload.policy.forbidden_domains : null)
  );
  const intent = typeof payload.intent === 'string' ? payload.intent.trim().toLowerCase() : '';
  if (intent && forbiddenDomains.includes(intent)) {
    return { ok: false, blockedReason: 'forbidden_domain' };
  }
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
      forbidDirectUrl: outputConstraints.forbidDirectUrl,
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
    const result = guardPaidAssistantOutput(output, { outputConstraints });
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
