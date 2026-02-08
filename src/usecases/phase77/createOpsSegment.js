'use strict';

const opsSegmentsRepo = require('../../repos/firestore/opsSegmentsRepo');

async function createOpsSegment(params, deps) {
  const payload = params || {};
  const repo = deps && deps.opsSegmentsRepo ? deps.opsSegmentsRepo : opsSegmentsRepo;
  const created = await repo.createSegment({
    segmentKey: payload.segmentKey,
    label: payload.label || '',
    filter: payload.filter || {},
    status: payload.status
  });
  const item = await repo.getSegmentByKey(payload.segmentKey);
  return {
    ok: true,
    created,
    item
  };
}

module.exports = {
  createOpsSegment
};
