'use strict';

const crypto = require('crypto');

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { validateWarnLinkBlock } = require('../../domain/validators');
const { DEFAULT_ALLOW_LISTS, sanitizeInput } = require('../../llm/allowList');
const { validateSchema } = require('../../llm/validateSchema');
const { FAQ_ANSWER_SCHEMA_ID } = require('../../llm/schemas');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');
const { appendAuditLog } = require('../audit/appendAuditLog');

const DEFAULT_TIMEOUT_MS = 2500;
const PROMPT_VERSION = 'faq_answer_v1';
const SYSTEM_PROMPT = [
  'You are a FAQ assistant.',
  'Use FAQAnswer.v1 schema.',
  'Do not include direct URLs; only cite sourceId.',
  'Advisory only.'
].join('\n');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSourceIds(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
}

function buildFallbackAnswer(question, sourceIds, nowIso, reason) {
  const citations = (sourceIds || []).map((sourceId) => ({
    sourceType: 'link_registry',
    sourceId
  }));
  return {
    schemaId: FAQ_ANSWER_SCHEMA_ID,
    generatedAt: nowIso,
    advisoryOnly: true,
    question,
    answer: reason || 'ソースが未設定のため回答できません。',
    citations
  };
}

function hashJson(value) {
  if (!value) return null;
  try {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  } catch (_err) {
    return null;
  }
}

async function callAdapter(adapter, payload, timeoutMs) {
  if (!adapter || typeof adapter.answerFaq !== 'function') return null;
  const exec = adapter.answerFaq(payload);
  const limit = typeof timeoutMs === 'number' ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('llm timeout')), limit);
  });
  return Promise.race([exec, timeout]);
}

async function filterWarnSources(sourceIds, deps) {
  const repo = deps && deps.linkRegistryRepo ? deps.linkRegistryRepo : linkRegistryRepo;
  if (!repo || typeof repo.getLink !== 'function') {
    return { allowed: sourceIds, blocked: [] };
  }
  const allowed = [];
  const blocked = [];
  for (const sourceId of sourceIds) {
    try {
      const entry = await repo.getLink(sourceId);
      if (!entry) {
        blocked.push(sourceId);
        continue;
      }
      validateWarnLinkBlock(entry);
      allowed.push(sourceId);
    } catch (_err) {
      blocked.push(sourceId);
    }
  }
  return { allowed, blocked };
}

function validateCitations(candidate, allowedSourceIds) {
  const citations = Array.isArray(candidate && candidate.citations) ? candidate.citations : [];
  const allowed = new Set(allowedSourceIds || []);
  for (const item of citations) {
    if (!item || item.sourceType !== 'link_registry') {
      return { ok: false, reason: 'invalid_citation_type' };
    }
    if (!allowed.has(item.sourceId)) {
      return { ok: false, reason: 'invalid_citation_source' };
    }
  }
  return { ok: true };
}

async function getFaqAnswer(params, deps) {
  const payload = params || {};
  const question = typeof payload.question === 'string' ? payload.question.trim() : '';
  if (!question) throw new Error('question required');

  const env = deps && deps.env ? deps.env : process.env;
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
  const llmEnabled = isLlmFeatureEnabled(env);
  const nowIso = new Date().toISOString();

  const sourceIds = normalizeSourceIds(payload.sourceIds);
  const filtered = await filterWarnSources(sourceIds, deps);

  const input = { question, sourceIds: filtered.allowed };
  const sanitized = sanitizeInput({ input, allowList: DEFAULT_ALLOW_LISTS.faqAnswer });

  let llmStatus = 'disabled';
  let llmUsed = false;
  let llmModel = null;
  let schemaErrors = [];
  let faqAnswer = buildFallbackAnswer(question, filtered.allowed, nowIso, filtered.allowed.length ? null : 'ソース未設定');

  if (!sanitized.ok) {
    llmStatus = 'allow_list_violation';
  } else if (!llmEnabled) {
    llmStatus = 'disabled';
  } else if (!deps || !deps.llmAdapter || typeof deps.llmAdapter.answerFaq !== 'function') {
    llmStatus = 'adapter_missing';
  } else {
    try {
      const adapterResult = await callAdapter(
        deps.llmAdapter,
        {
          schemaId: FAQ_ANSWER_SCHEMA_ID,
          promptVersion: PROMPT_VERSION,
          system: SYSTEM_PROMPT,
          input: sanitized.data
        },
        deps && typeof deps.llmTimeoutMs === 'number' ? deps.llmTimeoutMs : DEFAULT_TIMEOUT_MS
      );
      const candidate = isPlainObject(adapterResult && adapterResult.answer)
        ? adapterResult.answer
        : adapterResult;
      const validation = validateSchema(FAQ_ANSWER_SCHEMA_ID, candidate);
      if (validation.ok && candidate && candidate.question === question) {
        const citationCheck = validateCitations(candidate, filtered.allowed);
        if (citationCheck.ok) {
          faqAnswer = candidate;
          llmUsed = true;
          llmStatus = 'ok';
          llmModel = adapterResult && typeof adapterResult.model === 'string' ? adapterResult.model : null;
        } else {
          llmStatus = citationCheck.reason;
        }
      } else {
        schemaErrors = validation.errors;
        llmStatus = 'invalid_schema';
      }
    } catch (_err) {
      llmStatus = 'error';
    }
  }

  let auditId = null;
  if (auditFn) {
    try {
      const auditResult = await auditFn({
        action: 'LLM_FAQ_ANSWER',
        eventType: 'LLM_FAQ_ANSWER',
        type: 'FAQ_ANSWER',
        question,
        traceId: payload.traceId || null,
        schemaId: FAQ_ANSWER_SCHEMA_ID,
        llmStatus,
        llmUsed,
        llmModel,
        blockedSourceIds: filtered.blocked,
        inputHash: hashJson(sanitized.ok ? sanitized.data : input),
        outputHash: hashJson(faqAnswer)
      });
      auditId = auditResult && auditResult.id ? auditResult.id : null;
    } catch (_err) {
      auditId = null;
    }
  }

  return {
    ok: true,
    question,
    serverTime: nowIso,
    faqAnswer,
    llmUsed,
    llmStatus,
    llmModel,
    schemaErrors: schemaErrors.length ? schemaErrors : null,
    blockedSourceIds: filtered.blocked.length ? filtered.blocked : null,
    auditId
  };
}

module.exports = {
  getFaqAnswer
};
