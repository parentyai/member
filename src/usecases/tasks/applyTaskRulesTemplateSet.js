'use strict';

const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const journeyTemplatesRepo = require('../../repos/firestore/journeyTemplatesRepo');
const stepRuleChangeLogsRepo = require('../../repos/firestore/stepRuleChangeLogsRepo');
const { planTaskRulesTemplateSet } = require('./planTaskRulesTemplateSet');

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function createUsecaseError(code, statusCode, details) {
  const err = new Error(code);
  err.code = code;
  err.statusCode = statusCode;
  if (details && typeof details === 'object') err.details = details;
  return err;
}

async function applyTaskRulesTemplateSet(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};

  const templateInput = payload.template && typeof payload.template === 'object' ? payload.template : {};
  const templateId = normalizeText(payload.templateId || templateInput.templateId, '');
  const actor = normalizeText(payload.actor, 'unknown');
  const traceId = normalizeText(payload.traceId, null);
  const requestId = normalizeText(payload.requestId, null);

  const planned = planTaskRulesTemplateSet({
    templateId,
    template: Object.assign({}, templateInput, { templateId })
  }, resolvedDeps);

  if (!planned.ok) {
    throw createUsecaseError(planned.error || 'invalid_template_payload', 400, {
      warnings: planned.warnings || []
    });
  }

  const expectedPlanHash = planned.planHash;
  const providedPlanHash = normalizeText(payload.planHash, '');
  if (providedPlanHash && providedPlanHash !== expectedPlanHash) {
    throw createUsecaseError('plan_hash_mismatch', 409, { expectedPlanHash });
  }

  const rulesRepository = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const templateRepository = resolvedDeps.journeyTemplatesRepo || journeyTemplatesRepo;
  const logsRepository = resolvedDeps.stepRuleChangeLogsRepo || stepRuleChangeLogsRepo;

  const savedTemplate = await templateRepository.upsertJourneyTemplate(templateId, planned.template, actor);
  const savedRules = [];
  for (const rule of planned.compiledRules) {
    // eslint-disable-next-line no-await-in-loop
    const saved = await rulesRepository.upsertStepRule(rule.ruleId, rule, actor);
    savedRules.push(saved);
  }

  const allRules = await rulesRepository.listStepRules({ limit: 1000 });
  const namespacePrefix = `${templateId}__`;
  const desiredRuleIds = new Set(savedRules.map((item) => item.ruleId));

  const disabledRules = [];
  for (const existing of allRules) {
    if (!existing || !existing.ruleId || !String(existing.ruleId).startsWith(namespacePrefix)) continue;
    if (desiredRuleIds.has(existing.ruleId)) continue;
    if (existing.enabled !== true) continue;
    // eslint-disable-next-line no-await-in-loop
    const disabled = await rulesRepository.upsertStepRule(existing.ruleId, Object.assign({}, existing, {
      enabled: false
    }), actor);
    disabledRules.push(disabled);
  }

  await logsRepository.appendStepRuleChangeLog({
    action: 'template_set',
    actor,
    ruleId: `${templateId}__*`,
    traceId,
    requestId,
    planHash: expectedPlanHash,
    summary: {
      templateId,
      ruleCount: savedRules.length,
      disabledRuleCount: disabledRules.length,
      warningCount: planned.warnings.length
    },
    createdAt: new Date().toISOString()
  }).catch(() => null);

  return {
    ok: true,
    templateId,
    planHash: expectedPlanHash,
    template: savedTemplate,
    rules: savedRules,
    disabledRules,
    warnings: planned.warnings,
    summary: {
      ruleCount: savedRules.length,
      disabledRuleCount: disabledRules.length,
      warningCount: planned.warnings.length
    }
  };
}

module.exports = {
  applyTaskRulesTemplateSet,
  createUsecaseError
};
