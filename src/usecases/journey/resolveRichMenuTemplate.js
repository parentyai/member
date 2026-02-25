'use strict';

const richMenuPolicyRepo = require('../../repos/firestore/richMenuPolicyRepo');
const richMenuTemplatesRepo = require('../../repos/firestore/richMenuTemplatesRepo');
const richMenuPhaseProfilesRepo = require('../../repos/firestore/richMenuPhaseProfilesRepo');
const richMenuAssignmentRulesRepo = require('../../repos/firestore/richMenuAssignmentRulesRepo');
const richMenuBindingsRepo = require('../../repos/firestore/richMenuBindingsRepo');
const journeyPolicyRepo = require('../../repos/firestore/journeyPolicyRepo');

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeLocale(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : 'ja';
  if (!normalized) return 'ja';
  if (normalized === 'en') return 'en';
  return 'ja';
}

function normalizePlanTier(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'paid' || raw === 'pro') return 'paid';
  return 'free';
}

function normalizeHouseholdType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['single', 'couple', 'accompany1', 'accompany2'].includes(normalized)) return normalized;
  return 'single';
}

function resolveLegacyMenuKey(planTier, householdType) {
  if (planTier !== 'paid') return 'free_default';
  const type = normalizeHouseholdType(householdType);
  if (type === 'couple') return 'pro_couple';
  if (type === 'accompany1') return 'pro_accompany1';
  if (type === 'accompany2') return 'pro_accompany2';
  return 'pro_single';
}

function resolvePhaseId(journeyStage, profiles) {
  const stage = String(journeyStage || '').trim().toLowerCase();
  if (!stage) return null;
  const rows = Array.isArray(profiles) ? profiles : [];
  for (const profile of rows) {
    if (!profile || profile.status !== 'active') continue;
    const matchers = Array.isArray(profile.journeyStageMatchers) ? profile.journeyStageMatchers : [];
    if (matchers.includes(stage)) return profile.phaseId || null;
  }
  return null;
}

function targetMatches(target, context) {
  const payload = target && typeof target === 'object' ? target : {};
  if (payload.locale && payload.locale !== context.locale) return false;
  if (payload.planTier && payload.planTier !== context.planTier) return false;
  if (payload.phaseId && payload.phaseId !== context.phaseId) return false;
  return true;
}

function rankRule(rule, context) {
  if (!rule || rule.status !== 'active') return null;
  if (!targetMatches(rule.target, context)) return null;
  const target = rule.target || {};
  const hasPlan = Boolean(target.planTier);
  const hasPhase = Boolean(target.phaseId);
  let precedence = 0;
  if (hasPlan && hasPhase) precedence = 4;
  else if (hasPlan) precedence = 3;
  else if (hasPhase) precedence = 2;
  else precedence = 1;
  const priority = Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : 0;
  return { precedence, priority };
}

function sortRulesByRank(rankedRows) {
  return rankedRows.slice().sort((left, right) => {
    if (left.rank.precedence !== right.rank.precedence) return right.rank.precedence - left.rank.precedence;
    if (left.rank.priority !== right.rank.priority) return right.rank.priority - left.rank.priority;
    const leftId = String(left.rule.ruleId || '');
    const rightId = String(right.rule.ruleId || '');
    return leftId.localeCompare(rightId, 'ja');
  });
}

function isTemplateApplicable(template, context) {
  if (!template || template.status !== 'active') return false;
  const target = template.target && typeof template.target === 'object' ? template.target : {};
  if (target.locale && target.locale !== context.locale) return false;
  if (target.planTier && target.planTier !== context.planTier) return false;
  if (target.phaseId && target.phaseId !== context.phaseId) return false;
  return true;
}

function resolveLegacyRichMenuId(policy, menuKey) {
  const map = policy && policy.rich_menu_map && typeof policy.rich_menu_map === 'object'
    ? policy.rich_menu_map
    : {};
  const mapValue = typeof map[menuKey] === 'string' ? map[menuKey].trim() : '';
  if (mapValue) return mapValue;
  const envKey = `LINE_RICH_MENU_ID_${String(menuKey || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const envValue = typeof process.env[envKey] === 'string' ? process.env[envKey].trim() : '';
  return envValue || null;
}

async function resolveRichMenuTemplate(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};

  const lineUserId = normalizeLineUserId(payload.lineUserId);
  const locale = normalizeLocale(payload.locale);
  const planTier = normalizePlanTier(payload.planTier || payload.plan);

  const policyRepo = resolvedDeps.richMenuPolicyRepo || richMenuPolicyRepo;
  const templatesRepo = resolvedDeps.richMenuTemplatesRepo || richMenuTemplatesRepo;
  const phaseProfilesRepo = resolvedDeps.richMenuPhaseProfilesRepo || richMenuPhaseProfilesRepo;
  const rulesRepo = resolvedDeps.richMenuAssignmentRulesRepo || richMenuAssignmentRulesRepo;
  const bindingsRepo = resolvedDeps.richMenuBindingsRepo || richMenuBindingsRepo;
  const legacyJourneyPolicyRepo = resolvedDeps.journeyPolicyRepo || journeyPolicyRepo;

  const [policy, binding, phaseProfiles] = await Promise.all([
    payload.richMenuPolicy || policyRepo.getRichMenuPolicy(),
    payload.binding || (lineUserId ? bindingsRepo.getRichMenuBinding(lineUserId) : null),
    payload.phaseProfiles || phaseProfilesRepo.listRichMenuPhaseProfiles({ status: 'active' })
  ]);

  const phaseId = payload.phaseId || resolvePhaseId(payload.journeyStage, phaseProfiles);
  const context = {
    lineUserId,
    locale,
    planTier,
    phaseId: phaseId || null
  };

  const templateCache = new Map();
  async function getTemplate(templateId) {
    const id = typeof templateId === 'string' ? templateId.trim() : '';
    if (!id) return null;
    if (templateCache.has(id)) return templateCache.get(id);
    const loaded = await templatesRepo.getRichMenuTemplate(id);
    templateCache.set(id, loaded || null);
    return loaded || null;
  }

  const overrideTemplateId = binding && typeof binding.manualOverrideTemplateId === 'string'
    ? binding.manualOverrideTemplateId.trim()
    : '';
  if (overrideTemplateId) {
    const template = await getTemplate(overrideTemplateId);
    if (template && isTemplateApplicable(template, context)) {
      return {
        ok: true,
        source: 'per_user_override',
        lineUserId,
        locale,
        planTier,
        phaseId: context.phaseId,
        templateId: template.templateId,
        ruleId: null,
        richMenuId: template.lineMeta && template.lineMeta.richMenuId ? template.lineMeta.richMenuId : null,
        template,
        binding,
        policy,
        legacyMenuKey: null
      };
    }
  }

  const rules = payload.rules || await rulesRepo.listRichMenuAssignmentRules({ status: 'active' });
  const ranked = [];
  for (const rule of Array.isArray(rules) ? rules : []) {
    const rank = rankRule(rule, context);
    if (!rank) continue;
    ranked.push({ rule, rank });
  }

  const sorted = sortRulesByRank(ranked);
  for (const item of sorted) {
    const rule = item.rule;
    const template = await getTemplate(rule.templateId);
    if (!template || !isTemplateApplicable(template, context)) continue;
    return {
      ok: true,
      source: `rule_${item.rank.precedence}`,
      lineUserId,
      locale,
      planTier,
      phaseId: context.phaseId,
      templateId: template.templateId,
      ruleId: rule.ruleId,
      richMenuId: template.lineMeta && template.lineMeta.richMenuId ? template.lineMeta.richMenuId : null,
      template,
      binding,
      policy,
      legacyMenuKey: null
    };
  }

  const defaultTemplateId = policy && typeof policy.defaultTemplateId === 'string'
    ? policy.defaultTemplateId.trim()
    : '';
  if (defaultTemplateId) {
    const template = await getTemplate(defaultTemplateId);
    if (template && isTemplateApplicable(template, context)) {
      return {
        ok: true,
        source: 'default_template',
        lineUserId,
        locale,
        planTier,
        phaseId: context.phaseId,
        templateId: template.templateId,
        ruleId: null,
        richMenuId: template.lineMeta && template.lineMeta.richMenuId ? template.lineMeta.richMenuId : null,
        template,
        binding,
        policy,
        legacyMenuKey: null
      };
    }
  }

  if (policy && policy.allowLegacyJourneyPolicyFallback === true) {
    const menuKey = resolveLegacyMenuKey(planTier, payload.householdType);
    const journeyPolicy = payload.journeyPolicy || await legacyJourneyPolicyRepo.getJourneyPolicy();
    const legacyRichMenuId = resolveLegacyRichMenuId(journeyPolicy, menuKey);
    if (legacyRichMenuId) {
      return {
        ok: true,
        source: 'legacy_map',
        lineUserId,
        locale,
        planTier,
        phaseId: context.phaseId,
        templateId: null,
        ruleId: null,
        richMenuId: legacyRichMenuId,
        template: null,
        binding,
        policy,
        legacyMenuKey: menuKey
      };
    }
  }

  return {
    ok: true,
    source: 'none',
    lineUserId,
    locale,
    planTier,
    phaseId: context.phaseId,
    templateId: null,
    ruleId: null,
    richMenuId: null,
    template: null,
    binding,
    policy,
    legacyMenuKey: null
  };
}

module.exports = {
  resolveLegacyMenuKey,
  resolveRichMenuTemplate
};
