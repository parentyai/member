'use strict';

const opsSegmentsRepo = require('../../repos/firestore/opsSegmentsRepo');

async function listOpsSegments(params, deps) {
  const payload = params || {};
  const repo = deps && deps.opsSegmentsRepo ? deps.opsSegmentsRepo : opsSegmentsRepo;
  const items = await repo.listSegments({
    status: payload.status,
    limit: payload.limit
  });
  return {
    ok: true,
    items
  };
}

module.exports = {
  listOpsSegments
};
