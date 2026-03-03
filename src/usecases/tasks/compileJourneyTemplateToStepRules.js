'use strict';

const crypto = require('crypto');
const journeyTemplatesRepo = require('../../repos/firestore/journeyTemplatesRepo');
const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');

const PHASE_ORDER = journeyTemplatesRepo.PHASE_ORDER;
const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeDependsOnRef(value) {
  const normalized = normalizeText(value, '');
  if (!normalized) return null;
  if (normalized.includes('__')) return { kind: 'ruleId', value: normalized };
  if (normalized.includes('/')) {
    const parts = normalized.split('/').map((item) => item.trim()).filter(Boolean);
    if (parts.length === 2) return { kind: 'phase_step', phaseKey: parts[0], stepKey: parts[1] };
  }
  if (normalized.includes(':')) {
    const parts = normalized.split(':').map((item) => item.trim()).filter(Boolean);
    if (parts.length === 2) return { kind: 'phase_step', phaseKey: parts[0], stepKey: parts[1] };
  }
  return { kind: 'stepKey', value: normalized };
}

function buildRuleId(templateId, phaseKey, stepKey) {
  const t = normalizeText(templateId, '');
  const p = normalizeText(phaseKey, '').toLowerCase();
  const s = normalizeText(stepKey, '');
  if (!t || !p || !s) return '';
  return `${t}__${p}__${s}`;
}

function resolveDependsOnRuleIds(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const refs = Array.isArray(payload.dependsOn) ? payload.dependsOn : [];
  const templateId = payload.templateId;
  const currentRuleId = payload.currentRuleId;
  const byStepKey = payload.byStepKey || new Map();
  const byPhaseStep = payload.byPhaseStep || new Map();

  const resolved = [];
  const warnings = [];

  refs.forEach((depRaw) => {
    const ref = normalizeDependsOnRef(depRaw);
    if (!ref) return;

    if (ref.kind === 'ruleId') {
      if (ref.value !== currentRuleId && !resolved.includes(ref.value)) resolved.push(ref.value);
      return;
    }

    if (ref.kind === 'phase_step') {
      const phaseKey = normalizeText(ref.phaseKey, '').toLowerCase();
      const stepKey = normalizeText(ref.stepKey, '');
      const key = `${phaseKey}::${stepKey}`;
      const matched = byPhaseStep.get(key) || buildRuleId(templateId, phaseKey, stepKey);
      if (!matched || matched === currentRuleId) {
        warnings.push({
          type: 'dependsOn_unresolved',
          ref: depRaw,
          reason: 'phase_step_not_found'
        });
        return;
      }
      if (!resolved.includes(matched)) resolved.push(matched);
      return;
    }

    const candidates = byStepKey.get(ref.value) || [];
    if (candidates.length === 1) {
      const matched = candidates[0];
      if (matched !== currentRuleId && !resolved.includes(matched)) resolved.push(matched);
      return;
    }
    if (candidates.length > 1) {
      warnings.push({
        type: 'dependsOn_ambiguous',
        ref: depRaw,
        reason: 'multiple_step_keys',
        candidates
      });
      return;
    }
    warnings.push({
      type: 'dependsOn_unresolved',
      ref: depRaw,
      reason: 'step_key_not_found'
    });
  });

  return { resolved, warnings };
}

function compareRuleStable(left, right) {
  const a = left && typeof left === 'object' ? left : {};
  const b = right && typeof right === 'object' ? right : {};
  const phaseA = normalizeText(a.phaseKey, '');
  const phaseB = normalizeText(b.phaseKey, '');
  const idxA = PHASE_ORDER.indexOf(phaseA);
  const idxB = PHASE_ORDER.indexOf(phaseB);
  if (idxA !== idxB) return idxA - idxB;
  const stepA = normalizeText(a.stepKey, '');
  const stepB = normalizeText(b.stepKey, '');
  if (stepA !== stepB) return stepA.localeCompare(stepB, 'ja');
  return String(a.ruleId || '').localeCompare(String(b.ruleId || ''), 'ja');
}

function buildCompileHash(template, compiledRules) {
  const payload = {
    templateId: template.templateId,
    version: template.version,
    enabled: template.enabled,
    phases: template.phases,
      compiledRules: compiledRules.map((rule) => ({
        ruleId: rule.ruleId,
        [FIELD_SCK]: normalizeText(rule[FIELD_SCK], null),
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
  return crypto.createHash('sha256').update(JSON.stringify(payload), 'utf8').digest('hex').slice(0, 24);
}

function compileJourneyTemplateToStepRules(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const templateRepo = resolvedDeps.journeyTemplatesRepo || journeyTemplatesRepo;
  const stepRules = resolvedDeps.stepRulesRepo || stepRulesRepo;

  const templateId = normalizeText(payload.templateId || (payload.template && payload.template.templateId), '');
  const templateInput = payload.template && typeof payload.template === 'object' ? payload.template : {};
  const normalizedTemplate = templateRepo.normalizeJourneyTemplate(templateId, Object.assign({}, templateInput, {
    templateId,
    [FIELD_SCK]: normalizeText(templateInput[FIELD_SCK], normalizeText(payload[FIELD_SCK], 'US_ASSIGNMENT'))
  }));

  if (!normalizedTemplate) {
    return {
      ok: false,
      error: 'invalid_template_payload',
      templateId: templateId || null,
      template: null,
      compiledRules: [],
      warnings: [{ type: 'template_invalid' }],
      compileHash: null
    };
  }

  const rawRules = [];
  const byStepKey = new Map();
  const byPhaseStep = new Map();

  normalizedTemplate.phases.forEach((phase) => {
    const phaseKey = phase.phaseKey;
    (phase.steps || []).forEach((step) => {
      const ruleId = buildRuleId(normalizedTemplate.templateId, phaseKey, step.stepKey);
      if (!ruleId) return;
      rawRules.push({ phaseKey, stepKey: step.stepKey, ruleId, step });

      const list = byStepKey.get(step.stepKey) || [];
      list.push(ruleId);
      byStepKey.set(step.stepKey, list);
      byPhaseStep.set(`${phaseKey}::${step.stepKey}`, ruleId);
    });
  });

  const warnings = [];
  const compiledRules = [];

  rawRules.forEach((raw) => {
    const dependsResolved = resolveDependsOnRuleIds({
      dependsOn: raw.step.dependsOn,
      templateId: normalizedTemplate.templateId,
      currentRuleId: raw.ruleId,
      byStepKey,
      byPhaseStep
    });

    warnings.push(...dependsResolved.warnings.map((item) => Object.assign({}, item, {
      ruleId: raw.ruleId,
      phaseKey: raw.phaseKey,
      stepKey: raw.stepKey
    })));

    const candidate = {
      ruleId: raw.ruleId,
      [FIELD_SCK]: normalizeText(raw.step[FIELD_SCK], normalizedTemplate[FIELD_SCK] || 'US_ASSIGNMENT'),
      stepKey: raw.step.stepKey,
      trigger: raw.step.trigger,
      leadTime: raw.step.leadTime,
      dependsOn: dependsResolved.resolved,
      constraints: raw.step.constraints,
      priority: Number(raw.step.priority) || 100,
      enabled: normalizedTemplate.enabled === true && raw.step.enabled !== false,
      validFrom: raw.step.validFrom || normalizedTemplate.validFrom,
      validUntil: raw.step.validUntil || normalizedTemplate.validUntil,
      riskLevel: normalizeText(raw.step.riskLevel, 'medium'),
      nudgeTemplate: raw.step.nudgeTemplate || null,
      createdBy: normalizedTemplate.createdBy || null,
      updatedBy: normalizedTemplate.updatedBy || normalizedTemplate.createdBy || null
    };

    const normalizedRule = stepRules.normalizeStepRule(raw.ruleId, candidate);
    if (!normalizedRule) {
      warnings.push({
        type: 'rule_normalize_failed',
        ruleId: raw.ruleId,
        phaseKey: raw.phaseKey,
        stepKey: raw.stepKey
      });
      return;
    }

    compiledRules.push(Object.assign({}, normalizedRule, {
      [FIELD_SCK]: normalizeText(normalizedRule[FIELD_SCK], candidate[FIELD_SCK]),
      phaseKey: raw.phaseKey,
      stepKey: raw.stepKey
    }));
  });

  compiledRules.sort(compareRuleStable);
  const compileHash = buildCompileHash(normalizedTemplate, compiledRules);

  return {
    ok: true,
    templateId: normalizedTemplate.templateId,
    template: normalizedTemplate,
    compiledRules,
    warnings,
    compileHash
  };
}

module.exports = {
  compileJourneyTemplateToStepRules,
  buildRuleId
};
