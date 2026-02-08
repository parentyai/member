'use strict';

const notificationTemplatesRepo = require('../../repos/firestore/notificationTemplatesRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { buildSendSegment } = require('../phase66/buildSendSegment');
const { normalizeLineUserIds, computePlanHash, resolveDateBucket } = require('./segmentSendHash');

async function planSegmentSend(params, deps) {
  const payload = params || {};
  const templateKey = payload.templateKey;
  if (!templateKey) throw new Error('templateKey required');

  const requestedBy = payload.requestedBy || 'unknown';
  const templateRepo = deps && deps.notificationTemplatesRepo ? deps.notificationTemplatesRepo : notificationTemplatesRepo;
  const template = await templateRepo.getTemplateByKey(templateKey);
  if (!template) throw new Error('template not found');

  const segmentFn = deps && deps.buildSendSegment ? deps.buildSendSegment : buildSendSegment;
  const segment = await segmentFn(payload.segmentQuery || {}, deps);
  const lineUserIds = normalizeLineUserIds(segment.items);
  const now = deps && deps.now instanceof Date ? deps.now : new Date();
  const serverTime = now.toISOString();
  const serverTimeBucket = resolveDateBucket(now);
  const planHash = computePlanHash(templateKey, lineUserIds, serverTimeBucket);

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
      serverTimeBucket
    },
    snapshot: {
      templateKey,
      templateStatus: template.status || null,
      count: lineUserIds.length,
      lineUserIds,
      planHash,
      serverTimeBucket,
      segmentQuery: payload.segmentQuery || {},
      serverTime
    }
  });

  return {
    ok: true,
    serverTime,
    templateKey,
    count: lineUserIds.length,
    lineUserIds,
    planHash
  };
}

module.exports = {
  planSegmentSend
};
