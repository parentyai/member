'use strict';

const cityPackFeedbackRepo = require('../../repos/firestore/cityPackFeedbackRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const {
  resolveActor,
  resolveRequestId,
  resolveTraceId,
  logRouteError
} = require('./osContext');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function normalizeLimit(value, fallback, max) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
}

function parseActionPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-feedback\/([^/]+)\/(ack|reject|propose)$/);
  if (!match) return null;
  return { feedbackId: match[1], action: match[2] };
}

function parseDetailPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-feedback\/([^/]+)$/);
  if (!match) return null;
  return match[1];
}

async function handleList(req, res, context) {
  const url = new URL(req.url, 'http://localhost');
  const status = url.searchParams.get('status') || '';
  const limit = normalizeLimit(url.searchParams.get('limit'), 50, 200);
  const items = await cityPackFeedbackRepo.listFeedback({ status, limit });

  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.feedback.list',
    entityType: 'city_pack_feedback',
    entityId: 'query',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status: status || null,
      count: items.length
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    items: items.map((item) => ({
      feedbackId: item.id,
      status: item.status || null,
      lineUserId: item.lineUserId || null,
      regionCity: item.regionCity || null,
      regionState: item.regionState || null,
      regionKey: item.regionKey || null,
      feedbackText: item.feedbackText || null,
      traceId: item.traceId || null,
      requestId: item.requestId || null,
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null
    }))
  });
}

async function handleDetail(req, res, context, feedbackId) {
  const feedback = await cityPackFeedbackRepo.getFeedback(feedbackId);
  if (!feedback) {
    writeJson(res, 404, { ok: false, error: 'feedback not found' });
    return;
  }

  await appendAuditLog({
    actor: context.actor,
    action: 'city_pack.feedback.view',
    entityType: 'city_pack_feedback',
    entityId: feedbackId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status: feedback.status || null,
      regionKey: feedback.regionKey || null
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    item: Object.assign({ feedbackId: feedback.id }, feedback)
  });
}

async function handleAction(req, res, context, feedbackId, action) {
  const feedback = await cityPackFeedbackRepo.getFeedback(feedbackId);
  if (!feedback) {
    writeJson(res, 404, { ok: false, error: 'feedback not found' });
    return;
  }
  const nextStatus = action === 'ack' ? 'reviewed' : (action === 'reject' ? 'rejected' : 'proposed');
  await cityPackFeedbackRepo.updateFeedback(feedbackId, { status: nextStatus });

  await appendAuditLog({
    actor: context.actor,
    action: `city_pack.feedback.${action}`,
    entityType: 'city_pack_feedback',
    entityId: feedbackId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status: nextStatus,
      regionKey: feedback.regionKey || null
    }
  });

  writeJson(res, 200, {
    ok: true,
    traceId: context.traceId,
    feedbackId,
    status: nextStatus
  });
}

async function handleCityPackFeedback(req, res, bodyText) {
  const context = {
    actor: resolveActor(req),
    traceId: resolveTraceId(req),
    requestId: resolveRequestId(req)
  };
  try {
    const actionMatch = parseActionPath(req.url);
    if (actionMatch) {
      if (req.method !== 'POST') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
      }
      await handleAction(req, res, context, decodeURIComponent(actionMatch.feedbackId), actionMatch.action);
      return;
    }
    const detailId = parseDetailPath(req.url);
    if (detailId) {
      if (req.method !== 'GET') {
        writeJson(res, 405, { ok: false, error: 'method not allowed' });
        return;
      }
      await handleDetail(req, res, context, decodeURIComponent(detailId));
      return;
    }
    if (req.method !== 'GET') {
      writeJson(res, 405, { ok: false, error: 'method not allowed' });
      return;
    }
    await handleList(req, res, context);
  } catch (err) {
    logRouteError('admin.city_pack_feedback', err, context);
    writeJson(res, 500, { ok: false, error: 'error' });
  }
}

module.exports = {
  handleCityPackFeedback
};
