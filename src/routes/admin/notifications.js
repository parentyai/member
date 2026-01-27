'use strict';

const { testSendNotification } = require('../../usecases/notifications/testSendNotification');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');

function resolveActor(req) {
  const actor = req && req.headers && req.headers['x-actor'];
  if (typeof actor === 'string' && actor.trim().length > 0) return actor.trim();
  return 'unknown';
}

function isKillSwitchError(err) {
  return err && typeof err.message === 'string' && err.message.includes('kill switch');
}

async function handleTestSend(req, res, body, notificationId) {
  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('invalid json');
    return;
  }

  if (!payload.lineUserId) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('lineUserId required');
    return;
  }

  try {
    const killSwitch = await getKillSwitch();
    const result = await testSendNotification({
      lineUserId: payload.lineUserId,
      text: payload.text,
      notificationId: notificationId || payload.notificationId,
      sentAt: payload.sentAt,
      killSwitch
    });
    await appendAuditLog({
      actor: resolveActor(req),
      action: 'notifications.test_send',
      entityType: 'notification',
      entityId: notificationId || payload.notificationId || 'test',
      payloadSummary: {
        textLength: typeof payload.text === 'string' ? payload.text.length : 0
      }
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, id: result.id }));
  } catch (err) {
    if (isKillSwitchError(err)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('kill switch on');
      return;
    }
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('error');
  }
}

module.exports = {
  handleTestSend
};
