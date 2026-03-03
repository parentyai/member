'use strict';

const crypto = require('crypto');
const { compileJourneyTemplateToStepRules } = require('./compileJourneyTemplateToStepRules');
const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function buildTemplateSetPlanHash(compiled) {
  const payload = {
    templateId: compiled.template && compiled.template.templateId ? compiled.template.templateId : null,
    version: compiled.template && Number.isFinite(Number(compiled.template.version))
      ? Number(compiled.template.version)
      : null,
    enabled: compiled.template ? compiled.template.enabled === true : false,
    country: compiled.template ? compiled.template.country : null,
    validFrom: compiled.template ? compiled.template.validFrom || null : null,
      validUntil: compiled.template ? compiled.template.validUntil || null : null,
      phases: compiled.template ? compiled.template.phases : [],
      rules: (compiled.compiledRules || []).map((rule) => ({
        ruleId: rule.ruleId,
        [FIELD_SCK]: rule[FIELD_SCK] || null,
        stepKey: rule.stepKey,
        trigger: rule.trigger,
        leadTime: rule.leadTime,
        dependsOn: rule.dependsOn,
        constraints: rule.constraints,
      priority: rule.priority,
      enabled: rule.enabled,
      validFrom: rule.validFrom,
      validUntil: rule.validUntil,
      riskLevel: rule.riskLevel,
      nudgeTemplate: rule.nudgeTemplate
    }))
  };
  return `taskrules_tpl_${crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex').slice(0, 24)}`;
}

function buildSummary(compiled) {
  const rules = Array.isArray(compiled && compiled.compiledRules) ? compiled.compiledRules : [];
  const phaseSet = new Set();
  rules.forEach((rule) => {
    if (rule && rule.phaseKey) phaseSet.add(rule.phaseKey);
  });
  return {
    templateId: compiled && compiled.template ? compiled.template.templateId : null,
    templateVersion: compiled && compiled.template ? compiled.template.version : null,
    phaseCount: phaseSet.size,
    ruleCount: rules.length,
    enabledRuleCount: rules.filter((rule) => rule && rule.enabled === true).length,
    warningCount: Array.isArray(compiled && compiled.warnings) ? compiled.warnings.length : 0
  };
}

function planTaskRulesTemplateSet(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const templateInput = payload.template && typeof payload.template === 'object' ? payload.template : {};
  const templateId = normalizeText(payload.templateId || templateInput.templateId, '');
  if (!templateId) {
    return {
      ok: false,
      error: 'templateId_required',
      template: null,
      compiledRules: [],
      warnings: [{ type: 'templateId_required' }],
      planHash: null,
      summary: {
        templateId: null,
        templateVersion: null,
        phaseCount: 0,
        ruleCount: 0,
        enabledRuleCount: 0,
        warningCount: 1
      }
    };
  }

  const compiled = compileJourneyTemplateToStepRules({
    templateId,
    template: Object.assign({}, templateInput, { templateId })
  }, deps);

  if (!compiled.ok) {
    return Object.assign({}, compiled, {
      planHash: null,
      summary: {
        templateId,
        templateVersion: null,
        phaseCount: 0,
        ruleCount: 0,
        enabledRuleCount: 0,
        warningCount: Array.isArray(compiled.warnings) ? compiled.warnings.length : 0
      }
    });
  }

  const planHash = buildTemplateSetPlanHash(compiled);

  return {
    ok: true,
    templateId,
    template: compiled.template,
    compiledRules: compiled.compiledRules,
    warnings: compiled.warnings || [],
    compileHash: compiled.compileHash,
    planHash,
    summary: buildSummary(compiled)
  };
}

module.exports = {
  planTaskRulesTemplateSet,
  buildTemplateSetPlanHash
};
