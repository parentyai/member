'use strict';

const emergencyBulletinsRepo = require('../../repos/firestore/emergencyBulletinsRepo');
const { approveEmergencyBulletin } = require('./approveEmergencyBulletin');
const { appendEmergencyAudit } = require('./audit');
const { resolveEmergencyRecipientsForFanout } = require('./resolveEmergencyRecipients');
const { normalizeString } = require('./utils');

function normalizeMaxRecipients(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Number.isFinite(Number(fallback)) && Number(fallback) > 0 ? Math.floor(Number(fallback)) : 500;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), 10000);
}

function resolveDispatchRegion(rule, bulletin) {
  const ruleRegion = rule && rule.region && typeof rule.region === 'object'
    ? rule.region
    : null;
  if (ruleRegion) return ruleRegion;
  if (rule && typeof rule.region === 'string' && rule.region.trim()) {
    return { regionKey: rule.region.trim() };
  }
  if (rule && typeof rule.regionKey === 'string' && rule.regionKey.trim()) {
    return { regionKey: rule.regionKey.trim() };
  }
  if (bulletin && typeof bulletin.regionKey === 'string' && bulletin.regionKey.trim()) {
    return { regionKey: bulletin.regionKey.trim() };
  }
  return null;
}

async function autoDispatchEmergencyBulletin(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const bulletinId = normalizeString(payload.bulletinId);
  if (!bulletinId) throw new Error('bulletinId required');

  const actor = normalizeString(payload.actor) || 'emergency_auto_dispatch';
  const traceId = normalizeString(payload.traceId) || `trace_emergency_auto_dispatch_${Date.now()}`;
  const runId = normalizeString(payload.runId) || `emg_auto_${Date.now()}`;
  const requestId = normalizeString(payload.requestId);

  const getBulletin = deps && typeof deps.getBulletin === 'function'
    ? deps.getBulletin
    : emergencyBulletinsRepo.getBulletin;
  const approve = deps && typeof deps.approveEmergencyBulletin === 'function'
    ? deps.approveEmergencyBulletin
    : approveEmergencyBulletin;
  const resolveRecipients = deps && typeof deps.resolveEmergencyRecipientsForFanout === 'function'
    ? deps.resolveEmergencyRecipientsForFanout
    : resolveEmergencyRecipientsForFanout;

  const rule = payload.rule && typeof payload.rule === 'object' ? payload.rule : {};
  const ruleId = normalizeString(rule.ruleId) || normalizeString(rule.id);
  const ruleMaxRecipients = normalizeMaxRecipients(rule.maxRecipients, 500);
  const globalMaxRecipients = normalizeMaxRecipients(payload.maxRecipientsPerRun, ruleMaxRecipients);
  const maxRecipients = Math.min(ruleMaxRecipients, globalMaxRecipients);
  const role = normalizeString(rule.role);
  const membersOnly = rule.membersOnly === true;

  const bulletin = await getBulletin(bulletinId);
  if (!bulletin) {
    return {
      ok: false,
      reason: 'bulletin_not_found',
      bulletinId,
      ruleId,
      traceId,
      runId
    };
  }

  const status = typeof bulletin.status === 'string' ? bulletin.status.trim().toLowerCase() : 'draft';
  if (status !== 'draft') {
    return {
      ok: false,
      skipped: true,
      reason: `bulletin_status_${status}`,
      bulletinId,
      ruleId,
      traceId,
      runId
    };
  }

  const region = resolveDispatchRegion(rule, bulletin);
  const recipientPreview = await resolveRecipients({
    region,
    regionKey: bulletin.regionKey || null,
    membersOnly,
    role,
    maxRecipients
  }, deps);

  if (!recipientPreview.ok) {
    await appendEmergencyAudit({
      actor,
      action: 'emergency.auto_dispatch.blocked',
      entityType: 'emergency_bulletin',
      entityId: bulletinId,
      traceId,
      requestId,
      runId,
      payloadSummary: {
        reason: recipientPreview.reason,
        ruleId,
        unsupportedDimensions: recipientPreview.unsupportedDimensions || []
      }
    }, deps);
    return {
      ok: false,
      blocked: true,
      reason: recipientPreview.reason,
      bulletinId,
      ruleId,
      traceId,
      runId,
      recipientPreview
    };
  }

  if (recipientPreview.totalRecipientCount <= 0) {
    return {
      ok: false,
      blocked: true,
      reason: 'no_recipients',
      bulletinId,
      ruleId,
      traceId,
      runId,
      recipientPreview
    };
  }

  if (recipientPreview.totalRecipientCount > maxRecipients) {
    return {
      ok: false,
      blocked: true,
      reason: 'max_recipients_exceeded',
      bulletinId,
      ruleId,
      traceId,
      runId,
      recipientPreview,
      maxRecipients
    };
  }

  if (payload.dryRun === true) {
    await appendEmergencyAudit({
      actor,
      action: 'emergency.auto_dispatch.preview',
      entityType: 'emergency_bulletin',
      entityId: bulletinId,
      traceId,
      requestId,
      runId,
      payloadSummary: {
        reason: 'dry_run',
        ruleId,
        recipientCount: recipientPreview.totalRecipientCount
      }
    }, deps);
    return {
      ok: true,
      dryRun: true,
      bulletinId,
      ruleId,
      traceId,
      runId,
      recipientPreview,
      recipientCountApplied: recipientPreview.totalRecipientCount
    };
  }

  const dispatchReason = normalizeString(payload.dispatchReason) || 'rule_match_auto_send';
  await appendEmergencyAudit({
    actor,
    action: 'emergency.auto_dispatch.start',
    entityType: 'emergency_bulletin',
    entityId: bulletinId,
    traceId,
    requestId,
    runId,
    payloadSummary: {
      ruleId,
      dispatchReason,
      recipientCount: recipientPreview.totalRecipientCount
    }
  }, deps);

  const approvalResult = await approve({
    bulletinId,
    actor,
    requestId,
    traceId,
    dispatchContext: {
      mode: 'auto',
      ruleId,
      runId,
      priority: 'emergency',
      dispatchReason,
      region,
      membersOnly,
      role,
      maxRecipients,
      bypassFlags: {
        quietHoursBypass: true,
        capBypass: true
      },
      recipientPreview
    }
  }, deps);

  await appendEmergencyAudit({
    actor,
    action: approvalResult && approvalResult.ok ? 'emergency.auto_dispatch.sent' : 'emergency.auto_dispatch.failed',
    entityType: 'emergency_bulletin',
    entityId: bulletinId,
    traceId,
    requestId,
    runId,
    payloadSummary: {
      ruleId,
      dispatchReason,
      resultOk: Boolean(approvalResult && approvalResult.ok),
      failureReason: approvalResult && approvalResult.reason ? approvalResult.reason : null,
      deliveredCount: approvalResult && Number.isFinite(Number(approvalResult.deliveredCount))
        ? Number(approvalResult.deliveredCount)
        : null
    }
  }, deps);

  return Object.assign({
    bulletinId,
    ruleId,
    runId,
    traceId,
    dispatchReason,
    recipientPreview,
    recipientCountApplied: recipientPreview.totalRecipientCount
  }, approvalResult || { ok: false, reason: 'dispatch_failed' });
}

module.exports = {
  autoDispatchEmergencyBulletin
};
