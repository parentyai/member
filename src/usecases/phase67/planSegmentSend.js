'use strict';

const notificationTemplatesRepo = require('../../repos/firestore/notificationTemplatesRepo');
const templatesVRepo = require('../../repos/firestore/templatesVRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { buildSendSegment } = require('../phase66/buildSendSegment');
const { normalizeLineUserIds, computePlanHash, resolveDateBucket } = require('./segmentSendHash');

function parseTemplateVersion(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) throw new Error('invalid templateVersion');
  return Math.floor(num);
}

async function planSegmentSend(params, deps) {
  const payload = params || {};
  const templateKey = payload.templateKey;
  if (!templateKey) throw new Error('templateKey required');

  const requestedBy = payload.requestedBy || 'unknown';
  const templateRepo = deps && deps.notificationTemplatesRepo ? deps.notificationTemplatesRepo : notificationTemplatesRepo;
  const templatesV = deps && deps.templatesVRepo ? deps.templatesVRepo : templatesVRepo;
  const templateVersion = parseTemplateVersion(payload.templateVersion);
  let resolvedTemplate = null;
  let resolvedTemplateVersion = templateVersion;

  if (templateVersion !== null) {
    resolvedTemplate = await templatesV.getTemplateByVersion({ templateKey, version: templateVersion });
    if (!resolvedTemplate) throw new Error('template not found');
  } else {
    resolvedTemplate = await templatesV.getActiveTemplate({ templateKey });
    if (resolvedTemplate) {
      resolvedTemplateVersion = resolvedTemplate.version;
    }
  }

  if (!resolvedTemplate) {
    const legacy = await templateRepo.getTemplateByKey(templateKey);
    if (!legacy) throw new Error('template not found');
    resolvedTemplate = legacy;
    resolvedTemplateVersion = null;
  }

  const segmentFn = deps && deps.buildSendSegment ? deps.buildSendSegment : buildSendSegment;
  const segmentQuery = payload.segmentQuery || payload.filterSnapshot || {};
  const segment = await segmentFn(segmentQuery, deps);
  const lineUserIds = normalizeLineUserIds(segment.items);
  const now = deps && deps.now instanceof Date ? deps.now : new Date();
  const serverTime = now.toISOString();
  const serverTimeBucket = resolveDateBucket(now);
  const planHash = computePlanHash(templateKey, lineUserIds, serverTimeBucket);
  const segmentKey = payload.segmentKey || null;

  await appendAuditLog({
    actor: requestedBy,
    action: 'segment_send.plan',
    entityType: 'segment_send',
    entityId: templateKey,
    templateKey,
    payloadSummary: {
      templateKey,
      count: lineUserIds.length,
      planHash,
      requestedBy,
      serverTimeBucket,
      templateVersion: resolvedTemplateVersion,
      segmentKey
    },
    snapshot: {
      templateKey,
      templateStatus: resolvedTemplate.status || null,
      templateVersion: resolvedTemplateVersion,
      count: lineUserIds.length,
      lineUserIds,
      planHash,
      serverTimeBucket,
      segmentKey,
      filterSnapshot: payload.filterSnapshot || null,
      segmentQuery,
      serverTime
    }
  });

  return {
    ok: true,
    serverTime,
    templateKey,
    templateVersion: resolvedTemplateVersion,
    count: lineUserIds.length,
    lineUserIds,
    planHash
  };
}

module.exports = {
  planSegmentSend
};
