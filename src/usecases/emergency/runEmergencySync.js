'use strict';

const crypto = require('crypto');
const emergencyProvidersRepo = require('../../repos/firestore/emergencyProvidersRepo');
const emergencyRulesRepo = require('../../repos/firestore/emergencyRulesRepo');
const emergencyBulletinsRepo = require('../../repos/firestore/emergencyBulletinsRepo');
const emergencyDiffsRepo = require('../../repos/firestore/emergencyDiffsRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { ensureEmergencyProviders } = require('./ensureEmergencyProviders');
const { fetchProviderSnapshot } = require('./fetchProviderSnapshot');
const { normalizeAndDiffProvider } = require('./normalizeAndDiffProvider');
const { summarizeDraftWithLLM } = require('./summarizeDraftWithLLM');
const { selectBestEmergencyRule, resolveEmergencyEventType } = require('./emergencyRuleEngine');
const { autoDispatchEmergencyBulletin } = require('./autoDispatchEmergencyBulletin');
const { appendEmergencyAudit } = require('./audit');
const { normalizeString } = require('./utils');

function resolveNow(params, deps) {
  if (params && params.now instanceof Date) return params.now;
  if (deps && deps.now instanceof Date) return deps.now;
  return new Date();
}

function resolveTraceId(params, now) {
  const explicit = normalizeString(params && params.traceId);
  if (explicit) return explicit;
  return `trace_emergency_sync_${now.getTime()}_${crypto.randomUUID().slice(0, 8)}`;
}

function resolveRunId(params, now) {
  const explicit = normalizeString(params && params.runId);
  if (explicit) return explicit;
  return `emg_sync_${now.getTime()}`;
}

function normalizeProviderKeyArray(values) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values
    .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
    .filter(Boolean)));
}

function resolveBooleanEnvFlag(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') return false;
  return fallback === true;
}

function normalizeMaxRecipients(value, fallback, max) {
  const parsed = Number(value);
  const fallbackValue = Number.isFinite(Number(fallback)) && Number(fallback) > 0 ? Math.floor(Number(fallback)) : 2000;
  const maxValue = Number.isFinite(Number(max)) && Number(max) > 0 ? Math.floor(Number(max)) : 50000;
  if (!Number.isFinite(parsed) || parsed <= 0) return Math.min(Math.max(fallbackValue, 1), maxValue);
  return Math.min(Math.max(Math.floor(parsed), 1), maxValue);
}

function toMillis(value) {
  if (!value) return 0;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function isProviderDue(provider, now, forceRefresh, forceProviderKeys) {
  const row = provider && typeof provider === 'object' ? provider : {};
  if (row.status !== 'enabled') return false;
  if (forceRefresh === true) return true;
  const providerKey = normalizeString(row.providerKey);
  if (providerKey && forceProviderKeys.has(providerKey)) return true;

  const schedule = Number(row.scheduleMinutes);
  const scheduleMinutes = Number.isFinite(schedule) && schedule > 0
    ? Math.min(Math.max(Math.floor(schedule), 1), 24 * 60)
    : 10;

  const lastRunAtMs = toMillis(row.lastRunAt);
  if (!lastRunAtMs) return true;
  return now.getTime() - lastRunAtMs >= scheduleMinutes * 60 * 1000;
}

function shouldRunNormalize(fetchResult) {
  if (!fetchResult || fetchResult.ok !== true) return false;
  if (fetchResult.skipped === true) return false;
  if (fetchResult.changed === false) return false;
  if (Number(fetchResult.statusCode) === 304) return false;
  return true;
}

async function resolveDiffByBulletin(bulletin, deps) {
  const payload = bulletin && typeof bulletin === 'object' ? bulletin : {};
  const refs = payload.evidenceRefs && typeof payload.evidenceRefs === 'object' ? payload.evidenceRefs : {};
  const diffId = normalizeString(refs.diffId);
  if (!diffId) return null;
  const getDiff = deps && typeof deps.getDiff === 'function' ? deps.getDiff : emergencyDiffsRepo.getDiff;
  return getDiff(diffId).catch(() => null);
}

function buildRuleInputFromBulletin(bulletin, diff) {
  const row = bulletin && typeof bulletin === 'object' ? bulletin : {};
  const diffRow = diff && typeof diff === 'object' ? diff : {};
  return {
    providerKey: normalizeString(row.providerKey),
    severity: normalizeString(row.severity),
    regionKey: normalizeString(row.regionKey),
    category: normalizeString(row.category) || normalizeString(diffRow.category),
    diffType: normalizeString(diffRow.diffType) || 'update',
    eventType: resolveEmergencyEventType({
      category: normalizeString(row.category) || normalizeString(diffRow.category),
      diffType: normalizeString(diffRow.diffType) || 'update'
    })
  };
}

async function runProviderPipeline(input, deps) {
  const params = input && typeof input === 'object' ? input : {};
  const providerKey = normalizeString(params.providerKey);
  if (!providerKey) throw new Error('providerKey required');

  const runId = normalizeString(params.runId) || `emg_sync_${providerKey}_${Date.now()}`;
  const traceId = normalizeString(params.traceId) || `trace_emergency_sync_${Date.now()}`;
  const actor = normalizeString(params.actor) || 'emergency_sync_job';

  const fetchResult = await fetchProviderSnapshot({
    providerKey,
    runId,
    traceId,
    actor,
    forceRefresh: params.forceRefresh === true
  }, deps);

  let normalizeResult = null;
  const summarizeResults = [];

  if (shouldRunNormalize(fetchResult)) {
    normalizeResult = await normalizeAndDiffProvider({
      providerKey,
      snapshotId: fetchResult.snapshotId || null,
      payloadJson: fetchResult.payloadJson || null,
      payloadText: fetchResult.payloadText || null,
      runId,
      traceId,
      actor
    }, deps);

    const shouldSummarize = params.skipSummarize !== true
      && normalizeResult
      && Array.isArray(normalizeResult.diffIds)
      && normalizeResult.diffIds.length > 0;

    if (shouldSummarize) {
      for (const diffId of normalizeResult.diffIds) {
        const summarizeResult = await summarizeDraftWithLLM({
          diffId,
          runId: `${runId}__sum`,
          traceId,
          actor
        }, deps);
        summarizeResults.push(summarizeResult);
      }
    }
  }

  return {
    providerKey,
    runId,
    traceId,
    fetchResult,
    normalizeResult,
    summarizeResults
  };
}

async function runEmergencySync(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const now = resolveNow(payload, deps);
  const traceId = resolveTraceId(payload, now);
  const runId = resolveRunId(payload, now);
  const actor = normalizeString(payload.actor) || 'emergency_sync_job';
  const dryRun = payload.dryRun === true;

  const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'
    ? deps.getKillSwitch
    : systemFlagsRepo.getKillSwitch;
  const killSwitchOn = await getKillSwitch();
  if (killSwitchOn) {
    await appendEmergencyAudit({
      actor,
      action: 'emergency.sync.blocked',
      entityType: 'emergency_sync',
      entityId: runId,
      traceId,
      runId,
      payloadSummary: {
        reason: 'kill_switch_on'
      }
    }, deps);
    return {
      ok: false,
      blocked: true,
      reason: 'kill_switch_on',
      runId,
      traceId,
      providerResults: []
    };
  }

  await ensureEmergencyProviders({ traceId });

  const requestedProviderKeys = normalizeProviderKeyArray(payload.providerKeys);
  const singleProviderKey = normalizeString(payload.providerKey);
  if (singleProviderKey && !requestedProviderKeys.includes(singleProviderKey)) {
    requestedProviderKeys.push(singleProviderKey);
  }
  const forceProviderKeys = new Set(normalizeProviderKeyArray(payload.forceProviderKeys));

  await appendEmergencyAudit({
    actor,
    action: 'emergency.sync.start',
    entityType: 'emergency_sync',
    entityId: runId,
    traceId,
    runId,
    payloadSummary: {
      requestedProviderCount: requestedProviderKeys.length,
      forceProviderCount: forceProviderKeys.size,
      forceRefresh: payload.forceRefresh === true,
      skipSummarize: payload.skipSummarize === true,
      dryRun
    }
  }, deps);

  const providers = await emergencyProvidersRepo.listProviders(500);
  const requestedSet = requestedProviderKeys.length ? new Set(requestedProviderKeys) : null;

  const candidates = providers.filter((provider) => {
    const providerKey = normalizeString(provider && provider.providerKey);
    if (!providerKey) return false;
    if (requestedSet && !requestedSet.has(providerKey)) return false;
    return isProviderDue(provider, now, payload.forceRefresh === true, forceProviderKeys);
  });

  const providerResults = [];
  for (const provider of candidates) {
    const providerKey = normalizeString(provider && provider.providerKey);
    if (!providerKey) continue;

    const providerRunId = `${runId}__${providerKey}`;
    const providerResult = await runProviderPipeline({
      providerKey,
      runId: providerRunId,
      traceId,
      actor,
      forceRefresh: payload.forceRefresh === true || forceProviderKeys.has(providerKey),
      skipSummarize: payload.skipSummarize === true
    }, deps);
    providerResults.push(providerResult);
  }

  const listEnabledRules = deps && typeof deps.listEnabledRules === 'function'
    ? deps.listEnabledRules
    : emergencyRulesRepo.listEnabledRulesNow;
  const getBulletin = deps && typeof deps.getBulletin === 'function'
    ? deps.getBulletin
    : emergencyBulletinsRepo.getBulletin;
  const autoDispatch = deps && typeof deps.autoDispatchEmergencyBulletin === 'function'
    ? deps.autoDispatchEmergencyBulletin
    : autoDispatchEmergencyBulletin;
  const getEmergencyAutoSendEnabled = deps && typeof deps.getEmergencyAutoSendEnabled === 'function'
    ? deps.getEmergencyAutoSendEnabled
    : (typeof systemFlagsRepo.getEmergencyAutoSendEnabled === 'function'
      ? systemFlagsRepo.getEmergencyAutoSendEnabled
      : async () => false);
  const envAutoSendEnabled = resolveBooleanEnvFlag('ENABLE_EMERGENCY', false);
  const flagAutoSendEnabled = await getEmergencyAutoSendEnabled();
  const autoSendGateEnabled = envAutoSendEnabled && flagAutoSendEnabled;
  const maxRecipientsPerRun = normalizeMaxRecipients(
    payload.maxRecipientsPerRun,
    process.env.EMERGENCY_MAX_RECIPIENTS_PER_RUN || 2000,
    50000
  );

  let remainingRecipients = maxRecipientsPerRun;
  const autoDispatchPlan = [];
  const autoDispatchResults = [];

  for (const providerResult of providerResults) {
    const providerKey = normalizeString(providerResult && providerResult.providerKey);
    const normalizeResult = providerResult && providerResult.normalizeResult && typeof providerResult.normalizeResult === 'object'
      ? providerResult.normalizeResult
      : null;
    const draftBulletinIds = normalizeResult && Array.isArray(normalizeResult.draftBulletinIds)
      ? Array.from(new Set(normalizeResult.draftBulletinIds.map((item) => normalizeString(item)).filter(Boolean)))
      : [];
    if (!providerKey || draftBulletinIds.length === 0) continue;

    // eslint-disable-next-line no-await-in-loop
    const providerRules = await listEnabledRules({ providerKey, limit: 200 });
    for (const bulletinId of draftBulletinIds) {
      // eslint-disable-next-line no-await-in-loop
      const bulletin = await getBulletin(bulletinId);
      if (!bulletin) {
        autoDispatchPlan.push({
          providerKey,
          bulletinId,
          reason: 'bulletin_not_found'
        });
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const diff = await resolveDiffByBulletin(bulletin, deps);
      const ruleInput = buildRuleInputFromBulletin(bulletin, diff);
      const selected = selectBestEmergencyRule(providerRules, ruleInput);
      if (!selected.rule) {
        autoDispatchPlan.push({
          providerKey,
          bulletinId,
          reason: 'no_matching_rule',
          eventType: ruleInput.eventType
        });
        continue;
      }
      if (selected.rule.autoSend !== true) {
        autoDispatchPlan.push({
          providerKey,
          bulletinId,
          ruleId: selected.rule.id || null,
          reason: 'rule_auto_send_off',
          eventType: ruleInput.eventType
        });
        continue;
      }
      if (!autoSendGateEnabled) {
        autoDispatchPlan.push({
          providerKey,
          bulletinId,
          ruleId: selected.rule.id || null,
          reason: 'auto_send_gate_off',
          eventType: ruleInput.eventType,
          envAutoSendEnabled,
          flagAutoSendEnabled
        });
        continue;
      }
      if (!dryRun && remainingRecipients <= 0) {
        autoDispatchPlan.push({
          providerKey,
          bulletinId,
          ruleId: selected.rule.id || null,
          reason: 'max_recipients_per_run_reached',
          eventType: ruleInput.eventType
        });
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const dispatchResult = await autoDispatch({
        bulletinId,
        rule: selected.rule,
        runId,
        traceId,
        actor,
        dryRun,
        dispatchReason: 'rule_match_auto_send',
        maxRecipientsPerRun: remainingRecipients
      }, deps);

      autoDispatchResults.push(dispatchResult);
      autoDispatchPlan.push({
        providerKey,
        bulletinId,
        ruleId: selected.rule.id || null,
        reason: dispatchResult && dispatchResult.ok ? 'dispatched' : (dispatchResult && dispatchResult.reason ? dispatchResult.reason : 'dispatch_failed'),
        eventType: ruleInput.eventType,
        dryRun: dispatchResult && dispatchResult.dryRun === true
      });

      if (!dryRun && dispatchResult && dispatchResult.ok) {
        const applied = Number(dispatchResult.recipientCountApplied) || 0;
        if (applied > 0) remainingRecipients = Math.max(remainingRecipients - applied, 0);
      }
    }
  }

  const skippedProviderCount = (requestedSet ? requestedSet.size : providers.length) - candidates.length;

  await appendEmergencyAudit({
    actor,
    action: 'emergency.sync.finish',
    entityType: 'emergency_sync',
    entityId: runId,
    traceId,
    runId,
    payloadSummary: {
      providerCount: providerResults.length,
      skippedProviderCount: skippedProviderCount > 0 ? skippedProviderCount : 0,
      providerKeys: providerResults.map((item) => item.providerKey),
      dryRun,
      autoSendGateEnabled,
      envAutoSendEnabled,
      flagAutoSendEnabled,
      autoDispatchPlannedCount: autoDispatchPlan.length,
      autoDispatchAttemptedCount: autoDispatchResults.length
    }
  }, deps);

  return {
    ok: true,
    runId,
    traceId,
    providerCount: providerResults.length,
    providerResults,
    dryRun,
    autoSendGate: {
      enabled: autoSendGateEnabled,
      envEnabled: envAutoSendEnabled,
      systemFlagEnabled: flagAutoSendEnabled
    },
    maxRecipientsPerRun,
    remainingRecipients,
    autoDispatchPlan,
    autoDispatchResults
  };
}

module.exports = {
  runEmergencySync,
  isProviderDue
};
