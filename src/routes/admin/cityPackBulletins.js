'use strict';

const cityPackBulletinsRepo = require('../../repos/firestore/cityPackBulletinsRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { sendNotification } = require('../../usecases/notifications/sendNotification');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { enforceManagedFlowGuard } = require('./managedFlowGuard');
const { resolveActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { attachNotificationSendSummary } = require('../../domain/notificationSendSummary');

const ROUTE_TYPE = 'admin_route';
const LIST_ROUTE_KEY = 'admin.city_pack_bulletins_list';
const DETAIL_ROUTE_KEY = 'admin.city_pack_bulletins_detail';
const CREATE_ROUTE_KEY = 'admin.city_pack_bulletins_create';
const APPROVE_ROUTE_KEY = 'admin.city_pack_bulletins_approve';
const REJECT_ROUTE_KEY = 'admin.city_pack_bulletins_reject';
const SEND_ROUTE_KEY = 'admin.city_pack_bulletins_send';
const ROOT_ROUTE_KEY = 'admin.city_pack_bulletins';

function normalizeOutcomeOptions(routeKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = routeKey;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, routeKey, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(routeKey, outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseJsonBody(bodyText, res, routeKey) {
  try {
    return JSON.parse(bodyText || '{}');
  } catch (_err) {
    writeJson(res, routeKey, 400, { ok: false, error: 'invalid json' }, {
      state: 'error',
      reason: 'invalid_json'
    });
    return null;
  }
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
  writeJson(res, LIST_ROUTE_KEY, 200, { ok: true, traceId: context.traceId, items }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleGetBulletin(req, res, context, bulletinId) {
  const bulletin = await cityPackBulletinsRepo.getBulletin(bulletinId);
  if (!bulletin) {
    writeJson(res, DETAIL_ROUTE_KEY, 404, { ok: false, error: 'bulletin not found' }, {
      state: 'error',
      reason: 'bulletin_not_found'
    });
    return;
  }
  writeJson(res, DETAIL_ROUTE_KEY, 200, { ok: true, traceId: context.traceId, item: bulletin }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleCreateBulletin(req, res, bodyText, context) {
  const payload = parseJsonBody(bodyText, res, CREATE_ROUTE_KEY);
  if (!payload) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: 'city_pack.bulletin.create',
    payload
  });
  if (!guard) return;
  context.actor = guard.actor || context.actor;
  context.traceId = guard.traceId || context.traceId;
  const notificationId = typeof payload.notificationId === 'string' ? payload.notificationId.trim() : '';
  const cityPackId = typeof payload.cityPackId === 'string' ? payload.cityPackId.trim() : '';
  const summary = typeof payload.summary === 'string' ? payload.summary.trim() : '';
  const modulesUpdated = Array.isArray(payload.modulesUpdated)
    ? payload.modulesUpdated.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim().toLowerCase())
    : [];
  if (!cityPackId || !notificationId || !summary) {
    writeJson(res, CREATE_ROUTE_KEY, 400, { ok: false, error: 'cityPackId/notificationId/summary required' }, {
      state: 'error',
      reason: 'city_pack_id_notification_id_summary_required'
    });
    return;
  }
  const notification = await notificationsRepo.getNotification(notificationId);
  if (!notification) {
    writeJson(res, CREATE_ROUTE_KEY, 404, { ok: false, error: 'notification not found' }, {
      state: 'error',
      reason: 'notification_not_found'
    });
    return;
  }
  const created = await cityPackBulletinsRepo.createBulletin({
    cityPackId,
    notificationId,
    summary,
    modulesUpdated,
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
      notificationId,
      modulesUpdatedCount: modulesUpdated.length
    }
  });
  writeJson(res, CREATE_ROUTE_KEY, 201, { ok: true, traceId: context.traceId, bulletinId: created.id }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleApproveBulletin(req, res, bodyText, context, bulletinId) {
  const payload = parseJsonBody(bodyText || '{}', res, APPROVE_ROUTE_KEY);
  if (!payload && bodyText) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: 'city_pack.bulletin.approve',
    payload
  });
  if (!guard) return;
  context.actor = guard.actor || context.actor;
  context.traceId = guard.traceId || context.traceId;
  const bulletin = await cityPackBulletinsRepo.getBulletin(bulletinId);
  if (!bulletin) {
    writeJson(res, APPROVE_ROUTE_KEY, 404, { ok: false, error: 'bulletin not found' }, {
      state: 'error',
      reason: 'bulletin_not_found'
    });
    return;
  }
  if (bulletin.status !== 'draft') {
    writeJson(res, APPROVE_ROUTE_KEY, 409, { ok: false, error: 'bulletin_not_draft' }, {
      state: 'blocked',
      reason: 'bulletin_not_draft'
    });
    return;
  }
  const notificationId = payload && typeof payload.notificationId === 'string' ? payload.notificationId.trim() : '';
  const resolvedNotificationId = bulletin.notificationId || notificationId || null;
  if (!resolvedNotificationId) {
    writeJson(res, APPROVE_ROUTE_KEY, 409, { ok: false, error: 'notificationId required' }, {
      state: 'blocked',
      reason: 'notification_id_required'
    });
    return;
  }
  const notification = await notificationsRepo.getNotification(resolvedNotificationId);
  if (!notification) {
    writeJson(res, APPROVE_ROUTE_KEY, 404, { ok: false, error: 'notification not found' }, {
      state: 'error',
      reason: 'notification_not_found'
    });
    return;
  }
  await cityPackBulletinsRepo.updateBulletin(bulletinId, {
    status: 'approved',
    approvedAt: new Date().toISOString(),
    notificationId: resolvedNotificationId
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
  writeJson(res, APPROVE_ROUTE_KEY, 200, {
    ok: true,
    traceId: context.traceId,
    bulletinId,
    notificationId: resolvedNotificationId
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleRejectBulletin(req, res, context, bulletinId) {
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: 'city_pack.bulletin.reject',
    payload: {}
  });
  if (!guard) return;
  context.actor = guard.actor || context.actor;
  context.traceId = guard.traceId || context.traceId;
  const bulletin = await cityPackBulletinsRepo.getBulletin(bulletinId);
  if (!bulletin) {
    writeJson(res, REJECT_ROUTE_KEY, 404, { ok: false, error: 'bulletin not found' }, {
      state: 'error',
      reason: 'bulletin_not_found'
    });
    return;
  }
  if (bulletin.status === 'sent') {
    writeJson(res, REJECT_ROUTE_KEY, 409, { ok: false, error: 'bulletin_already_sent' }, {
      state: 'blocked',
      reason: 'bulletin_already_sent'
    });
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
  writeJson(res, REJECT_ROUTE_KEY, 200, { ok: true, traceId: context.traceId, bulletinId }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleSendBulletin(req, res, context, bulletinId) {
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: 'city_pack.bulletin.send',
    payload: {}
  });
  if (!guard) return;
  context.actor = guard.actor || context.actor;
  context.traceId = guard.traceId || context.traceId;
  const bulletin = await cityPackBulletinsRepo.getBulletin(bulletinId);
  if (!bulletin) {
    writeJson(res, SEND_ROUTE_KEY, 404, { ok: false, error: 'bulletin not found' }, {
      state: 'error',
      reason: 'bulletin_not_found'
    });
    return;
  }
  if (bulletin.status !== 'approved') {
    writeJson(res, SEND_ROUTE_KEY, 409, { ok: false, error: 'bulletin_not_approved' }, {
      state: 'blocked',
      reason: 'bulletin_not_approved'
    });
    return;
  }
  if (!bulletin.notificationId) {
    writeJson(res, SEND_ROUTE_KEY, 409, { ok: false, error: 'notificationId required' }, {
      state: 'blocked',
      reason: 'notification_id_required'
    });
    return;
  }
  const killSwitch = await getKillSwitch();
  try {
    const rawResult = await sendNotification({
      notificationId: bulletin.notificationId,
      killSwitch,
      continueOnError: true,
      applyAttentionBudget: true,
      cityPackId: bulletin.cityPackId || null,
      cityPackModulesUpdated: Array.isArray(bulletin.modulesUpdated) ? bulletin.modulesUpdated : [],
      traceId: context.traceId,
      requestId: context.requestId,
      actor: context.actor
    });
    const result = attachNotificationSendSummary(rawResult);
    const partialFailure = result.sendSummary && result.sendSummary.partialFailure === true;
    await cityPackBulletinsRepo.updateBulletin(bulletinId, partialFailure
      ? {
        status: 'approved',
        sendResult: {
          ok: false,
          reason: 'send_partial_failure',
          sendSummary: result.sendSummary || null,
          failureSample: Array.isArray(result.failureSample) ? result.failureSample.slice(0, 20) : []
        },
        deliveredCount: Number(result.deliveredCount) || 0
      }
      : {
        status: 'sent',
        sentAt: new Date().toISOString(),
        deliveredCount: Number(result.deliveredCount) || 0,
        sendResult: {
          ok: true,
          sendSummary: result.sendSummary || null
        }
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
        deliveredCount: Number(result.deliveredCount) || 0,
        skippedCount: Number(result.skippedCount) || 0,
        failedCount: Number(result.failedCount) || 0,
        partialFailure,
        sendSummary: result.sendSummary || null,
        modulesUpdatedCount: Array.isArray(bulletin.modulesUpdated) ? bulletin.modulesUpdated.length : 0
      }
    });
    writeJson(res, SEND_ROUTE_KEY, partialFailure ? 207 : 200, {
      ok: partialFailure ? false : true,
      partial: partialFailure,
      reason: partialFailure ? 'send_partial_failure' : null,
      traceId: context.traceId,
      bulletinId,
      deliveredCount: Number(result.deliveredCount) || 0,
      skippedCount: Number(result.skippedCount) || 0,
      failedCount: Number(result.failedCount) || 0,
      sendSummary: result.sendSummary || null
    }, {
      state: partialFailure ? 'degraded' : 'success',
      reason: partialFailure ? 'send_partial_failure' : 'completed'
    });
  } catch (err) {
    if (isKillSwitchError(err)) {
      writeJson(res, SEND_ROUTE_KEY, 403, { ok: false, error: 'kill switch on' }, {
        state: 'blocked',
        reason: 'kill_switch_on'
      });
      return;
    }
    const message = err && err.message ? err.message : 'error';
    writeJson(res, SEND_ROUTE_KEY, 500, { ok: false, error: message }, {
      state: 'error',
      reason: 'error'
    });
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
        await handleApproveBulletin(req, res, bodyText, context, action.bulletinId);
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
    writeJson(res, ROOT_ROUTE_KEY, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found'
    });
  } catch (err) {
    logRouteError('admin.city_pack_bulletins', err, context);
    writeJson(res, ROOT_ROUTE_KEY, 500, { ok: false, error: 'error' }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleCityPackBulletins
};
