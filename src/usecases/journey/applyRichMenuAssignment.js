'use strict';

const { linkRichMenuToUser } = require('../../infra/lineClient');
const richMenuPolicyRepo = require('../../repos/firestore/richMenuPolicyRepo');
const richMenuBindingsRepo = require('../../repos/firestore/richMenuBindingsRepo');
const richMenuRateBucketsRepo = require('../../repos/firestore/richMenuRateBucketsRepo');
const richMenuTemplatesRepo = require('../../repos/firestore/richMenuTemplatesRepo');
const { resolveRichMenuTemplate } = require('./resolveRichMenuTemplate');

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeBoolean(value) {
  return value === true;
}

function resolveFeatureEnabled() {
  const raw = process.env.ENABLE_RICH_MENU_DYNAMIC;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return !(normalized === '0' || normalized === 'false' || normalized === 'off');
}

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed);
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date;
  }
  return null;
}

function addSecondsIso(baseDate, seconds) {
  const millis = Math.max(0, Number(seconds) || 0) * 1000;
  return new Date(baseDate.getTime() + millis).toISOString();
}

function computeNextEligibleAt(binding, cooldownSeconds, now) {
  const cooldown = Math.max(0, Number(cooldownSeconds) || 0);
  if (cooldown <= 0) return now.toISOString();

  const existing = parseDateValue(binding && binding.nextEligibleAt);
  if (existing && existing.getTime() > now.getTime()) return existing.toISOString();

  const appliedAt = parseDateValue(binding && binding.appliedAt);
  if (appliedAt) {
    const next = new Date(appliedAt.getTime() + cooldown * 1000);
    if (next.getTime() > now.getTime()) return next.toISOString();
  }
  return now.toISOString();
}

function isCooldownBlocked(binding, cooldownSeconds, now) {
  const cooldown = Math.max(0, Number(cooldownSeconds) || 0);
  if (cooldown <= 0) return { blocked: false, nextEligibleAt: now.toISOString() };
  const nextEligibleAt = computeNextEligibleAt(binding, cooldown, now);
  const next = parseDateValue(nextEligibleAt);
  if (next && next.getTime() > now.getTime()) {
    return {
      blocked: true,
      nextEligibleAt: next.toISOString(),
      remainingSeconds: Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000))
    };
  }
  return { blocked: false, nextEligibleAt: nextEligibleAt || now.toISOString() };
}

async function resolveFallbackTemplate(policy, deps) {
  const fallbackTemplateId = policy && typeof policy.fallbackTemplateId === 'string'
    ? policy.fallbackTemplateId.trim()
    : '';
  if (!fallbackTemplateId) return null;
  const templatesRepo = deps.richMenuTemplatesRepo || richMenuTemplatesRepo;
  const template = await templatesRepo.getRichMenuTemplate(fallbackTemplateId);
  if (!template || template.status !== 'active') return null;
  const richMenuId = template.lineMeta && typeof template.lineMeta.richMenuId === 'string'
    ? template.lineMeta.richMenuId.trim()
    : '';
  if (!richMenuId) return null;
  return {
    templateId: template.templateId,
    richMenuId
  };
}

async function applyRichMenuAssignment(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeLineUserId(payload.lineUserId);
  if (!lineUserId) {
    return { ok: false, status: 'invalid', reason: 'lineUserId required' };
  }

  if (!resolveFeatureEnabled()) {
    return { ok: true, status: 'disabled_by_env', lineUserId };
  }

  const policyRepo = resolvedDeps.richMenuPolicyRepo || richMenuPolicyRepo;
  const bindingsRepo = resolvedDeps.richMenuBindingsRepo || richMenuBindingsRepo;
  const rateBucketsRepo = resolvedDeps.richMenuRateBucketsRepo || richMenuRateBucketsRepo;
  const templatesRepo = resolvedDeps.richMenuTemplatesRepo || richMenuTemplatesRepo;

  const now = payload.now instanceof Date ? payload.now : new Date();
  const dryRun = normalizeBoolean(payload.dryRun);
  const actor = typeof payload.actor === 'string' && payload.actor.trim() ? payload.actor.trim() : 'unknown';
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null;

  const policy = payload.richMenuPolicy || await policyRepo.getRichMenuPolicy();
  if (!policy || policy.enabled !== true) {
    return { ok: true, status: 'disabled_by_policy', lineUserId, policy };
  }

  if (!dryRun && policy.updateEnabled !== true) {
    return {
      ok: true,
      status: 'blocked_by_policy_killswitch',
      lineUserId,
      policy
    };
  }

  const binding = payload.binding || await bindingsRepo.getRichMenuBinding(lineUserId);

  const cooldownDecision = isCooldownBlocked(binding, policy.cooldownSeconds, now);
  if (!dryRun && cooldownDecision.blocked) {
    return {
      ok: true,
      status: 'cooldown',
      lineUserId,
      nextEligibleAt: cooldownDecision.nextEligibleAt,
      remainingSeconds: cooldownDecision.remainingSeconds,
      policy
    };
  }

  if (!dryRun) {
    const rateMax = Number.isFinite(Number(policy.maxAppliesPerMinute)) ? Number(policy.maxAppliesPerMinute) : 60;
    const bucketId = rateBucketsRepo.resolveBucketId(now);
    const rateResult = await rateBucketsRepo.incrementAndCheckRateBucket({
      bucketId,
      maxCount: Math.max(1, Math.floor(rateMax)),
      actor,
      traceId,
      now
    });
    if (!rateResult.allowed) {
      return {
        ok: true,
        status: 'rate_limited',
        lineUserId,
        rate: rateResult,
        policy
      };
    }
  }

  const resolution = await resolveRichMenuTemplate(Object.assign({}, payload, {
    lineUserId,
    richMenuPolicy: policy,
    binding
  }), resolvedDeps);

  const nextEligibleAt = addSecondsIso(now, policy.cooldownSeconds);

  if (!resolution || !resolution.richMenuId) {
    await bindingsRepo.upsertRichMenuBinding(lineUserId, {
      currentTemplateId: resolution ? resolution.templateId : null,
      resolvedRuleId: resolution ? resolution.ruleId : null,
      planTier: resolution ? resolution.planTier : null,
      phaseId: resolution ? resolution.phaseId : null,
      lastApplyResult: {
        status: 'menu_missing',
        source: resolution ? resolution.source : 'none',
        at: now.toISOString()
      },
      lastTraceId: traceId,
      nextEligibleAt,
      lastError: 'rich_menu_not_configured'
    });
    return {
      ok: true,
      status: 'menu_missing',
      lineUserId,
      resolution,
      policy
    };
  }

  if (dryRun) {
    return {
      ok: true,
      status: 'dry_run',
      lineUserId,
      richMenuId: resolution.richMenuId,
      resolution,
      policy,
      nextEligibleAt
    };
  }

  const before = binding || {};
  const patchBase = {
    previousTemplateId: before.currentTemplateId || null,
    currentTemplateId: resolution.templateId || null,
    resolvedRuleId: resolution.ruleId || null,
    planTier: resolution.planTier || null,
    phaseId: resolution.phaseId || null,
    currentMenuKey: resolution.legacyMenuKey || null,
    currentRichMenuId: resolution.richMenuId,
    lastTraceId: traceId,
    appliedAt: now.toISOString(),
    nextEligibleAt,
    lastError: null
  };

  try {
    await linkRichMenuToUser(lineUserId, resolution.richMenuId);
    await bindingsRepo.upsertRichMenuBinding(lineUserId, Object.assign({}, patchBase, {
      lastApplyResult: {
        status: 'applied',
        source: resolution.source,
        actor,
        at: now.toISOString()
      }
    }));
    return {
      ok: true,
      status: 'applied',
      lineUserId,
      richMenuId: resolution.richMenuId,
      resolution,
      policy,
      nextEligibleAt
    };
  } catch (err) {
    const message = err && err.message ? String(err.message) : 'rich_menu_apply_failed';
    const fallback = await resolveFallbackTemplate(policy, { richMenuTemplatesRepo: templatesRepo });

    if (fallback && fallback.richMenuId && fallback.richMenuId !== resolution.richMenuId) {
      try {
        await linkRichMenuToUser(lineUserId, fallback.richMenuId);
        await bindingsRepo.upsertRichMenuBinding(lineUserId, Object.assign({}, patchBase, {
          previousTemplateId: resolution.templateId || before.currentTemplateId || null,
          currentTemplateId: fallback.templateId,
          currentRichMenuId: fallback.richMenuId,
          lastApplyResult: {
            status: 'applied_fallback',
            source: resolution.source,
            fallbackTemplateId: fallback.templateId,
            actor,
            at: now.toISOString()
          },
          lastError: message
        }));
        return {
          ok: true,
          status: 'applied_fallback',
          lineUserId,
          richMenuId: fallback.richMenuId,
          resolution,
          fallbackTemplateId: fallback.templateId,
          reason: message,
          policy,
          nextEligibleAt
        };
      } catch (fallbackErr) {
        const fallbackMessage = fallbackErr && fallbackErr.message ? String(fallbackErr.message) : 'rich_menu_fallback_failed';
        await bindingsRepo.upsertRichMenuBinding(lineUserId, Object.assign({}, patchBase, {
          lastApplyResult: {
            status: 'error',
            source: resolution.source,
            actor,
            at: now.toISOString(),
            reason: fallbackMessage
          },
          lastError: fallbackMessage
        }));
        return {
          ok: false,
          status: 'error',
          lineUserId,
          richMenuId: resolution.richMenuId,
          resolution,
          reason: fallbackMessage,
          policy,
          nextEligibleAt
        };
      }
    }

    await bindingsRepo.upsertRichMenuBinding(lineUserId, Object.assign({}, patchBase, {
      lastApplyResult: {
        status: 'error',
        source: resolution.source,
        actor,
        at: now.toISOString(),
        reason: message
      },
      lastError: message
    }));

    return {
      ok: false,
      status: 'error',
      lineUserId,
      richMenuId: resolution.richMenuId,
      resolution,
      reason: message,
      policy,
      nextEligibleAt
    };
  }
}

module.exports = {
  applyRichMenuAssignment
};
