'use strict';

const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const emergencyDiffsRepo = require('../../repos/firestore/emergencyDiffsRepo');
const emergencyBulletinsRepo = require('../../repos/firestore/emergencyBulletinsRepo');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');
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
  return `trace_emergency_llm_${now.getTime()}`;
}

function resolveRunId(params, now) {
  const explicit = normalizeString(params && params.runId);
  if (explicit) return explicit;
  return `emg_sum_${now.getTime()}`;
}

function buildSummaryInput(diff) {
  const row = diff && typeof diff === 'object' ? diff : {};
  const changedKeys = Array.isArray(row.changedKeys) ? row.changedKeys.join(', ') : '';
  return {
    providerKey: row.providerKey || null,
    regionKey: row.regionKey || null,
    category: row.category || null,
    diffType: row.diffType || null,
    severity: row.severity || null,
    changedKeys: changedKeys || null
  };
}

function buildDefaultSummary(diff) {
  const row = diff && typeof diff === 'object' ? diff : {};
  const category = row.category || 'alert';
  const region = row.regionKey || '-';
  const diffType = row.diffType || 'update';
  const changedKeys = Array.isArray(row.changedKeys) && row.changedKeys.length
    ? row.changedKeys.join(', ')
    : '-';
  return `(${category}) ${region} / ${diffType} / changed: ${changedKeys}`;
}

async function invokeSummary(diff, deps) {
  if (deps && typeof deps.summarizeFn === 'function') {
    const result = await deps.summarizeFn(buildSummaryInput(diff));
    if (typeof result === 'string') return normalizeString(result);
    if (result && typeof result === 'object') {
      return normalizeString(result.summaryDraft || result.summary || result.text);
    }
  }
  return null;
}

function mergeBulletinMessage(currentMessage, summaryDraft) {
  const current = normalizeString(currentMessage) || '';
  const summary = normalizeString(summaryDraft) || '';
  if (!summary) return current || null;
  if (!current) return summary;
  if (current.includes(summary)) return current;
  return `${current}\n\n要約: ${summary}`;
}

async function summarizeDraftWithLLM(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const diffId = normalizeString(payload.diffId);
  if (!diffId) throw new Error('diffId required');

  const now = resolveNow(payload, deps);
  const traceId = resolveTraceId(payload, now);
  const runId = resolveRunId(payload, now);
  const actor = normalizeString(payload.actor) || 'emergency_provider_summarize_job';

  const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'
    ? deps.getKillSwitch
    : systemFlagsRepo.getKillSwitch;
  const killSwitchOn = await getKillSwitch();
  if (killSwitchOn) {
    await appendEmergencyAudit({
      actor,
      action: 'emergency.provider.summarize.blocked',
      entityType: 'emergency_diff',
      entityId: diffId,
      traceId,
      runId,
      payloadSummary: { reason: 'kill_switch_on' }
    }, deps);
    return {
      ok: false,
      blocked: true,
      reason: 'kill_switch_on',
      diffId,
      traceId,
      runId
    };
  }

  const llmEnabled = deps && typeof deps.getLlmEnabled === 'function'
    ? await deps.getLlmEnabled()
    : await systemFlagsRepo.getLlmEnabled();
  const envFlag = isLlmFeatureEnabled((deps && deps.env) || process.env);
  if (!envFlag || !llmEnabled) {
    await appendEmergencyAudit({
      actor,
      action: 'emergency.provider.summarize.skipped',
      entityType: 'emergency_diff',
      entityId: diffId,
      traceId,
      runId,
      payloadSummary: {
        reason: !envFlag ? 'llm_feature_flag_off' : 'llm_system_flag_off',
        llmEnabled: Boolean(llmEnabled),
        envFlag
      }
    }, deps);
    return {
      ok: true,
      skipped: true,
      reason: !envFlag ? 'llm_feature_flag_off' : 'llm_system_flag_off',
      diffId,
      traceId,
      runId
    };
  }

  const diff = await emergencyDiffsRepo.getDiff(diffId);
  if (!diff) {
    return {
      ok: false,
      reason: 'diff_not_found',
      diffId,
      traceId,
      runId
    };
  }

  let summaryDraft = await invokeSummary(diff, deps);
  if (!summaryDraft) {
    summaryDraft = buildDefaultSummary(diff);
  }

  await emergencyDiffsRepo.updateDiff(diffId, {
    summaryDraft,
    traceId
  });

  const draftId = emergencyBulletinsRepo.resolveDraftIdFromDiff(diffId);
  const bulletin = await emergencyBulletinsRepo.getBulletin(draftId).catch(() => null);
  if (bulletin && bulletin.status === 'draft') {
    await emergencyBulletinsRepo.updateBulletin(draftId, {
      messageDraft: mergeBulletinMessage(bulletin.messageDraft, summaryDraft),
      traceId
    });
  }

  await appendEmergencyAudit({
    actor,
    action: 'emergency.provider.summarize.finish',
    entityType: 'emergency_diff',
    entityId: diffId,
    traceId,
    runId,
    payloadSummary: {
      diffId,
      bulletinId: bulletin ? bulletin.id : null,
      summaryLength: summaryDraft.length
    }
  }, deps);

  return {
    ok: true,
    diffId,
    bulletinId: bulletin ? bulletin.id : null,
    summaryDraft,
    traceId,
    runId
  };
}

module.exports = {
  summarizeDraftWithLLM
};
