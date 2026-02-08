'use strict';

const sendRetryQueueRepo = require('../../repos/firestore/sendRetryQueueRepo');

function parseLimit(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) throw new Error('invalid limit');
  return Math.floor(num);
}

async function listRetryQueue(params, deps) {
  const payload = params || {};
  const limit = parseLimit(payload.limit);
  const repo = deps && deps.sendRetryQueueRepo ? deps.sendRetryQueueRepo : sendRetryQueueRepo;
  const items = await repo.listPending(limit || 50);
  return {
    ok: true,
    serverTime: new Date().toISOString(),
    items
  };
}

module.exports = {
  listRetryQueue
};
