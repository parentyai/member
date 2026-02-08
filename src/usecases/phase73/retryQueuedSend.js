'use strict';

const sendRetryQueueRepo = require('../../repos/firestore/sendRetryQueueRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { testSendNotification } = require('../notifications/testSendNotification');

function resolvePayloadSnapshot(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.payloadSnapshot && typeof item.payloadSnapshot === 'object') return item.payloadSnapshot;
  return null;
}

async function retryQueuedSend(params, deps) {
  const payload = params || {};
  const queueId = payload.queueId;
  if (!queueId) throw new Error('queueId required');

  const repo = deps && deps.sendRetryQueueRepo ? deps.sendRetryQueueRepo : sendRetryQueueRepo;
  const sendFn = deps && deps.sendFn ? deps.sendFn : testSendNotification;
  const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;

  const item = await repo.getQueueItem(queueId);
  if (!item) return { ok: false, reason: 'queue_not_found' };
  if (item.status && item.status !== 'PENDING') {
    return { ok: false, reason: 'queue_not_pending', status: item.status };
  }

  const snapshot = resolvePayloadSnapshot(item);
  if (!snapshot || !snapshot.lineUserId) {
    return { ok: false, reason: 'payload_missing' };
  }

  const killSwitch = await killSwitchFn();
  if (killSwitch) {
    return { ok: false, reason: 'kill_switch_on' };
  }

  try {
    await sendFn({
      lineUserId: snapshot.lineUserId,
      text: snapshot.text || '',
      notificationId: snapshot.notificationId || item.templateKey || 'retry',
      killSwitch
    }, deps);
    await repo.markDone(queueId);
    return { ok: true, queueId };
  } catch (err) {
    const message = err && err.message ? err.message : 'send_failed';
    await repo.markFailed(queueId, message);
    return { ok: false, reason: 'send_failed', error: message };
  }
}

module.exports = {
  retryQueuedSend
};
