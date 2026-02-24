'use strict';

const { linkRichMenuToUser } = require('../../infra/lineClient');
const journeyPolicyRepo = require('../../repos/firestore/journeyPolicyRepo');
const richMenuBindingsRepo = require('../../repos/firestore/richMenuBindingsRepo');

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

  if (!resolveRichMenuFeatureEnabled()) {
    return { ok: true, status: 'disabled_by_env' };
  }

  const policy = payload.journeyPolicy || await policyRepo.getJourneyPolicy();
  if (!policy || policy.enabled !== true || policy.rich_menu_enabled !== true) {
    return { ok: true, status: 'disabled_by_policy' };
  }

  const menuKey = resolveMenuKey(payload.plan, payload.householdType);
  const richMenuId = resolveRichMenuId(policy, menuKey);
  if (!richMenuId) {
    await bindingsRepo.upsertRichMenuBinding(lineUserId, {
      currentMenuKey: menuKey,
      currentRichMenuId: null,
      lastError: `rich_menu_not_configured:${menuKey}`
    });
    return { ok: true, status: 'menu_missing', menuKey };
  }

  try {
    await linkRichMenuToUser(lineUserId, richMenuId);
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
  } catch (err) {
    const message = err && err.message ? String(err.message) : 'rich_menu_apply_failed';
    await bindingsRepo.upsertRichMenuBinding(lineUserId, {
      currentMenuKey: menuKey,
      currentRichMenuId: richMenuId,
      lastError: message,
      appliedAt: new Date().toISOString()
    });
    return {
      ok: false,
      status: 'error',
      menuKey,
      richMenuId,
      reason: message
    };
  }
}

module.exports = {
  resolveMenuKey,
  applyPersonalizedRichMenu
};
