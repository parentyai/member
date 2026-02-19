'use strict';

const cityPackBulletinsRepo = require('../../repos/firestore/cityPackBulletinsRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { sendNotification } = require('../../usecases/notifications/sendNotification');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolveActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function normalizeLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 50;
  return Math.min(Math.floor(num), 200);
}

function parseActionPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-bulletins\/([^/]+)\/(approve|reject|send)$/);
  if (!match) return null;
  return {
    bulletinId: decodeURIComponent(match[1]),
    action: match[2]
  };
}

function parseDetailPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-bulletins\/([^/]+)$/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

function isKillSwitchError(err) {
  return err && typeof err.message === 'string' && err.message.includes('kill switch');
}

async function handleListBulletins(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const status = (url.searchParams.get('status') || '').trim() || null;
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const items = await cityPackBulletinsRepo.listBulletins({ status, limit });
  writeJson(res, 200, { ok: true, traceId: context.traceId, items });
}

async function handleGetBulletin(req, res, context, bulletinId) {
  const bulletin = await cityPackBulletinsRepo.getBulletin(bulletinId);
  if (!bulletin) {
    writeJson(res, 404, { ok: false, error: 'bulletin not found' });
    return;
  }
  writeJson(res, 200, { ok: true, traceId: context.traceId, item: bulletin });
}

async function handleCreateBulletin(req, res, bodyText, context) {
  const payload = parseJson(bodyText, res);
  if (!payload) return;
  const notificationId = typeof payload.notificationId === 'string' ? payload.notificationId.trim() : '';
  const cityPackId = typeof payload.cityPackId === 'string' ? payload.cityPackId.trim() : '';
  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : '';
  if (!cityPackId || !notificationId || !summary) {
    writeJson(res, 400, { ok: false, error: 'cityPackId/notificationId/summary required' });
    return;
  }
  const notification = await notificationsRepo.getNotification(notificationId);
  if (!notification) {
    writeJson(res, 404, { ok: false, error: 'notification not found' });
    return;
  }
  const created = await cityPackBulletinsRepo.createBulletin({
    cityPackId,
    notificationId,
    summary,
    traceId: context.traceId,
    requestId: payload.requestId || null,
    status: 'draft'
  });
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.bulletin.create',
    entityType: 'city_pack_bulletin',
    entityId: created.id,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      cityPackId,
      notificationId
    }
  });
  writeJson(res, 201, { ok: true, traceId: context.traceId, bulletinId: created.id });
}

async function handleApproveBulletin(req, res, context, bulletinId) {
  const bulletin = await cityPackBulletinsRepo.getBulletin(bulletinId);
  if (!bulletin) {
    writeJson(res, 404, { ok: false, error: 'bulletin not found' });
    return;
  }
  if (bulletin.status !== 'draft') {
    writeJson(res, 409, { ok: false, error: 'bulletin_not_draft' });
    return;
  }
  await cityPackBulletinsRepo.updateBulletin(bulletinId, {
    status: 'approved',
    approvedAt: new Date().toISOString()
  });
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.bulletin.approve',
    entityType: 'city_pack_bulletin',
    entityId: bulletinId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      cityPackId: bulletin.cityPackId || null
    }
  });
  writeJson(res, 200, { ok: true, traceId: context.traceId, bulletinId });
}

async function handleRejectBulletin(req, res, context, bulletinId) {
  const bulletin = await cityPackBulletinsRepo.getBulletin(bulletinId);
  if (!bulletin) {
    writeJson(res, 404, { ok: false, error: 'bulletin not found' });
    return;
  }
  if (bulletin.status === 'sent') {
    writeJson(res, 409, { ok: false, error: 'bulletin_already_sent' });
    return;
  }
  await cityPackBulletinsRepo.updateBulletin(bulletinId, {
    status: 'rejected'
  });
  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.bulletin.reject',
    entityType: 'city_pack_bulletin',
    entityId: bulletinId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      cityPackId: bulletin.cityPackId || null
    }
  });
  writeJson(res, 200, { ok: true, traceId: context.traceId, bulletinId });
}

async function handleSendBulletin(req, res, context, bulletinId) {
  const bulletin = await cityPackBulletinsRepo.getBulletin(bulletinId);
  if (!bulletin) {
    writeJson(res, 404, { ok: false, error: 'bulletin not found' });
    return;
  }
  if (bulletin.status !== 'approved') {
    writeJson(res, 409, { ok: false, error: 'bulletin_not_approved' });
    return;
  }
  const killSwitch = await getKillSwitch();
  try {
    const result = await sendNotification({
      notificationId: bulletin.notificationId,
      killSwitch,
      traceId: context.traceId,
      requestId: context.requestId,
      actor: context.actor
    });
    await cityPackBulletinsRepo.updateBulletin(bulletinId, {
      status: 'sent',
      sentAt: new Date().toISOString(),
      deliveredCount: Number(result.deliveredCount) || 0
    });
    await appendAuditLog({
      actor: context.actor,
      action: 'city_pack.bulletin.send',
      entityType: 'city_pack_bulletin',
      entityId: bulletinId,
      traceId: context.traceId,
      requestId: context.requestId,
      payloadSummary: {
        cityPackId: bulletin.cityPackId || null,
        notificationId: bulletin.notificationId || null,
        deliveredCount: Number(result.deliveredCount) || 0
      }
    });
    writeJson(res, 200, {
      ok: true,
      traceId: context.traceId,
      bulletinId,
      deliveredCount: Number(result.deliveredCount) || 0
    });
  } catch (err) {
    if (isKillSwitchError(err)) {
      writeJson(res, 403, { ok: false, error: 'kill switch on' });
      return;
    }
    const message = err && err.message ? err.message : 'error';
    writeJson(res, 500, { ok: false, error: message });
  }
}

async function handleCityPackBulletins(req, res, bodyText) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const context = {
    actor: resolveActor(req),
    requestId: resolveRequestId(req),
    traceId: resolveTraceId(req)
  };

  try {
    if (req.method === 'GET' && pathname === '/api/admin/city-pack-bulletins') {
      await handleListBulletins(req, res, context);
      return;
    }
    if (req.method === 'GET') {
      const detailId = parseDetailPath(pathname);
      if (detailId) {
        await handleGetBulletin(req, res, context, detailId);
        return;
      }
    }
    if (req.method === 'POST' && pathname === '/api/admin/city-pack-bulletins') {
      await handleCreateBulletin(req, res, bodyText, context);
      return;
    }
    if (req.method === 'POST') {
      const action = parseActionPath(pathname);
      if (action && action.action === 'approve') {
        await handleApproveBulletin(req, res, context, action.bulletinId);
        return;
      }
      if (action && action.action === 'reject') {
        await handleRejectBulletin(req, res, context, action.bulletinId);
        return;
      }
      if (action && action.action === 'send') {
        await handleSendBulletin(req, res, context, action.bulletinId);
        return;
      }
    }
    writeJson(res, 404, { ok: false, error: 'not found' });
  } catch (err) {
    logRouteError('admin.city_pack_bulletins', err, context);
    writeJson(res, 500, { ok: false, error: 'error' });
  }
}

module.exports = {
  handleCityPackBulletins
};
