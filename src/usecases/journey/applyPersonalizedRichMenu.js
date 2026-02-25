'use strict';

const journeyPolicyRepo = require('../../repos/firestore/journeyPolicyRepo');
const richMenuBindingsRepo = require('../../repos/firestore/richMenuBindingsRepo');
const { applyRichMenuAssignment } = require('./applyRichMenuAssignment');

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizePlan(value) {
  return String(value || '').trim().toLowerCase() === 'pro' ? 'pro' : 'free';
}

function normalizeHouseholdType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['single', 'couple', 'accompany1', 'accompany2'].includes(normalized)) return normalized;
  return 'single';
}

function resolveRichMenuFeatureEnabled() {
  const raw = process.env.ENABLE_RICH_MENU_DYNAMIC;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return !(normalized === '0' || normalized === 'false' || normalized === 'off');
}

function resolveMenuKey(plan, householdType) {
  if (normalizePlan(plan) !== 'pro') return 'free_default';
  const type = normalizeHouseholdType(householdType);
  if (type === 'couple') return 'pro_couple';
  if (type === 'accompany1') return 'pro_accompany1';
  if (type === 'accompany2') return 'pro_accompany2';
  return 'pro_single';
}

function resolveRichMenuId(policy, menuKey) {
  const map = policy && policy.rich_menu_map && typeof policy.rich_menu_map === 'object'
    ? policy.rich_menu_map
    : {};
  const mapValue = typeof map[menuKey] === 'string' ? map[menuKey].trim() : '';
  if (mapValue) return mapValue;
  const envKey = `LINE_RICH_MENU_ID_${String(menuKey || '').toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
  const envValue = typeof process.env[envKey] === 'string' ? process.env[envKey].trim() : '';
  return envValue || null;
}

async function applyPersonalizedRichMenu(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeLineUserId(payload.lineUserId);
  if (!lineUserId) {
    return { ok: false, status: 'invalid', reason: 'lineUserId required' };
  }

  const policyRepo = resolvedDeps.journeyPolicyRepo || journeyPolicyRepo;
  const bindingsRepo = resolvedDeps.richMenuBindingsRepo || richMenuBindingsRepo;
  const assignmentFn = resolvedDeps.applyRichMenuAssignment || applyRichMenuAssignment;

  if (!resolveRichMenuFeatureEnabled()) {
    return { ok: true, status: 'disabled_by_env' };
  }

  const policy = payload.journeyPolicy || await policyRepo.getJourneyPolicy();
  if (!policy || policy.enabled !== true || policy.rich_menu_enabled !== true) {
    return { ok: true, status: 'disabled_by_policy' };
  }

  const result = await assignmentFn(Object.assign({}, payload, {
    lineUserId,
    journeyPolicy: policy
  }), resolvedDeps);

  const menuKey = result && result.resolution && result.resolution.legacyMenuKey
    ? result.resolution.legacyMenuKey
    : resolveMenuKey(payload.plan, payload.householdType);
  const richMenuId = result && result.richMenuId ? result.richMenuId : null;

  if (result && (result.status === 'applied' || result.status === 'applied_fallback')) {
    await bindingsRepo.upsertRichMenuBinding(lineUserId, {
      currentMenuKey: menuKey,
      currentRichMenuId: richMenuId,
      lastError: null,
      appliedAt: new Date().toISOString()
    });
    return {
      ok: true,
      status: 'applied',
      menuKey,
      richMenuId
    };
  }

  if (result && result.status === 'menu_missing') {
    await bindingsRepo.upsertRichMenuBinding(lineUserId, {
      currentMenuKey: menuKey,
      currentRichMenuId: null,
      lastError: `rich_menu_not_configured:${menuKey}`
    });
    return { ok: true, status: 'menu_missing', menuKey };
  }

  if (result && result.status === 'disabled_by_policy') {
    return { ok: true, status: 'disabled_by_policy' };
  }

  if (result && result.status === 'disabled_by_env') {
    return { ok: true, status: 'disabled_by_env' };
  }

  if (result && (result.status === 'cooldown' || result.status === 'rate_limited' || result.status === 'blocked_by_policy_killswitch')) {
    return {
      ok: true,
      status: result.status,
      menuKey,
      richMenuId
    };
  }

  const reason = result && result.reason ? result.reason : 'rich_menu_apply_failed';
  await bindingsRepo.upsertRichMenuBinding(lineUserId, {
    currentMenuKey: menuKey,
    currentRichMenuId: richMenuId,
    lastError: reason,
    appliedAt: new Date().toISOString()
  });
  return {
    ok: false,
    status: 'error',
    menuKey,
    richMenuId,
    reason
  };
}

module.exports = {
  resolveMenuKey,
  applyPersonalizedRichMenu
};
