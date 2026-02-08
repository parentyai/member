'use strict';

const opsSegmentsRepo = require('../../repos/firestore/opsSegmentsRepo');

async function getOpsSegment(params, deps) {
  const payload = params || {};
  if (!payload.segmentKey) throw new Error('segmentKey required');
  const repo = deps && deps.opsSegmentsRepo ? deps.opsSegmentsRepo : opsSegmentsRepo;
  const item = await repo.getSegmentByKey(payload.segmentKey);
  if (!item) return { ok: false, reason: 'segment_not_found' };
  return { ok: true, item };
}

module.exports = {
  getOpsSegment
};
