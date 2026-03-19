'use strict';

const cityPackFeedbackRepo = require('../../repos/firestore/cityPackFeedbackRepo');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const {
  resolveActor,
  resolveRequestId,
  resolveTraceId,
  parseJson,
  logRouteError
} = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const LIST_ROUTE_KEY = 'admin.city_pack_feedback_list';
const DETAIL_ROUTE_KEY = 'admin.city_pack_feedback_detail';
const ACTION_ROUTE_KEY = 'admin.city_pack_feedback_action';

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

function normalizeLimit(value, fallback, max) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.min(Math.floor(num), max);
}

function parseActionPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-feedback\/([^/]+)\/(ack|triage|resolve|reject|propose)$/);
  if (!match) return null;
  return { feedbackId: match[1], action: match[2] };
}

function parseDetailPath(pathname) {
  const match = pathname.match(/^\/api\/admin\/city-pack-feedback\/([^/]+)$/);
  if (!match) return null;
  return match[1];
}

async function handleList(req, res, context, deps) {
  const url = new URL(req.url, 'http://localhost');
  const status = url.searchParams.get('status') || '';
  const packClass = url.searchParams.get('packClass') || '';
  const language = url.searchParams.get('language') || '';
  const limit = normalizeLimit(url.searchParams.get('limit'), 50, 200);
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const listFeedback = typeof resolvedDeps.listFeedback === 'function'
    ? resolvedDeps.listFeedback
    : cityPackFeedbackRepo.listFeedback;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const items = await listFeedback({ status, packClass, language, limit });

  await appendAudit({
    actor: context.actor,
    action: 'city_pack.feedback.list',
    entityType: 'city_pack_feedback',
    entityId: 'query',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status: status || null,
      packClass: packClass || null,
      language: language || null,
      count: items.length
    }
  });

  writeJson(res, LIST_ROUTE_KEY, 200, {
    ok: true,
    traceId: context.traceId,
    items: items.map((item) => ({
      feedbackId: item.id,
      status: item.status || null,
      lineUserId: item.lineUserId || null,
      regionCity: item.regionCity || null,
      regionState: item.regionState || null,
      regionKey: item.regionKey || null,
      packClass: item.packClass || 'regional',
      language: item.language || 'ja',
      slotKey: item.slotKey || null,
      feedbackText: item.feedbackText || null,
      message: item.message || item.feedbackText || null,
      resolution: item.resolution || null,
      resolvedAt: item.resolvedAt || null,
      traceId: item.traceId || null,
      requestId: item.requestId || null,
      createdAt: item.createdAt || null,
      updatedAt: item.updatedAt || null
    }))
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleDetail(req, res, context, feedbackId, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getFeedback = typeof resolvedDeps.getFeedback === 'function'
    ? resolvedDeps.getFeedback
    : cityPackFeedbackRepo.getFeedback;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const feedback = await getFeedback(feedbackId);
  if (!feedback) {
    writeJson(res, DETAIL_ROUTE_KEY, 404, { ok: false, error: 'feedback not found' }, {
      state: 'error',
      reason: 'feedback_not_found'
    });
    return;
  }

  await appendAudit({
    actor: context.actor,
    action: 'city_pack.feedback.view',
    entityType: 'city_pack_feedback',
    entityId: feedbackId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status: feedback.status || null,
      regionKey: feedback.regionKey || null,
      packClass: feedback.packClass || 'regional',
      language: feedback.language || 'ja'
    }
  });

  writeJson(res, DETAIL_ROUTE_KEY, 200, {
    ok: true,
    traceId: context.traceId,
    item: Object.assign({ feedbackId: feedback.id }, feedback)
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function ensureCityPackFeedbackWriteAllowed(res, context, feedback, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const readKillSwitch = typeof resolvedDeps.getKillSwitch === 'function'
    ? resolvedDeps.getKillSwitch
    : getKillSwitch;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const killSwitch = await readKillSwitch();
  if (!killSwitch) return true;
  await appendAudit({
    actor: context.actor,
    action: 'city_pack.feedback.blocked',
    entityType: 'city_pack_feedback',
    entityId: feedback && feedback.id ? feedback.id : 'unknown',
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      reason: 'kill_switch_on',
      regionKey: feedback && feedback.regionKey ? feedback.regionKey : null
    }
  });
  writeJson(res, ACTION_ROUTE_KEY, 409, { ok: false, error: 'kill switch on', traceId: context.traceId }, {
    state: 'blocked',
    reason: 'kill_switch_on'
  });
  return false;
}

async function handleAction(req, res, bodyText, context, feedbackId, action, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getFeedback = typeof resolvedDeps.getFeedback === 'function'
    ? resolvedDeps.getFeedback
    : cityPackFeedbackRepo.getFeedback;
  const updateFeedback = typeof resolvedDeps.updateFeedback === 'function'
    ? resolvedDeps.updateFeedback
    : cityPackFeedbackRepo.updateFeedback;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const feedback = await getFeedback(feedbackId);
  if (!feedback) {
    writeJson(res, ACTION_ROUTE_KEY, 404, { ok: false, error: 'feedback not found' }, {
      state: 'error',
      reason: 'feedback_not_found'
    });
    return;
  }
  const writeAllowed = await ensureCityPackFeedbackWriteAllowed(res, context, feedback, resolvedDeps);
  if (!writeAllowed) return;

  const payload = parseJson(bodyText || '{}', res);
  if (!payload) return;
  const resolutionInput = typeof payload.resolution === 'string' && payload.resolution.trim() ? payload.resolution.trim() : null;

  const nextStatus = action === 'resolve'
    ? 'resolved'
    : (action === 'ack' || action === 'triage')
      ? 'triaged'
      : action === 'reject'
        ? 'rejected'
        : 'proposed';
  const resolution = action === 'resolve'
    ? (resolutionInput || 'resolved_by_admin')
    : action === 'propose'
      ? (resolutionInput || feedback.resolution || null)
      : (feedback.resolution || null);
  await updateFeedback(feedbackId, {
    status: nextStatus,
    resolution,
    resolvedAt: action === 'resolve' ? new Date().toISOString() : (feedback.resolvedAt || null)
  });

  await appendAudit({
    actor: context.actor,
    action: `city_pack.feedback.${action}`,
    entityType: 'city_pack_feedback',
    entityId: feedbackId,
    traceId: context.traceId,
    requestId: context.requestId,
    payloadSummary: {
      status: nextStatus,
      regionKey: feedback.regionKey || null,
      slotKey: feedback.slotKey || null,
      packClass: feedback.packClass || 'regional',
      language: feedback.language || 'ja'
    }
  });

  writeJson(res, ACTION_ROUTE_KEY, 200, {
    ok: true,
    traceId: context.traceId,
    feedbackId,
    status: nextStatus
  }, {
    state: 'success',
    reason: 'completed'
  });
}

async function handleCityPackFeedback(req, res, bodyText, deps) {
  const context = {
    actor: resolveActor(req),
    traceId: resolveTraceId(req),
    requestId: resolveRequestId(req)
  };
  let routeKey = LIST_ROUTE_KEY;
  try {
    const actionMatch = parseActionPath(req.url);
    if (actionMatch) {
      routeKey = ACTION_ROUTE_KEY;
      if (req.method !== 'POST') {
        writeJson(res, ACTION_ROUTE_KEY, 405, { ok: false, error: 'method not allowed' }, {
          state: 'error',
          reason: 'method_not_allowed'
        });
        return;
      }
      await handleAction(req, res, bodyText, context, decodeURIComponent(actionMatch.feedbackId), actionMatch.action, deps);
      return;
    }
    const detailId = parseDetailPath(req.url);
    if (detailId) {
      routeKey = DETAIL_ROUTE_KEY;
      if (req.method !== 'GET') {
        writeJson(res, DETAIL_ROUTE_KEY, 405, { ok: false, error: 'method not allowed' }, {
          state: 'error',
          reason: 'method_not_allowed'
        });
        return;
      }
      await handleDetail(req, res, context, decodeURIComponent(detailId), deps);
      return;
    }
    if (req.method !== 'GET') {
      writeJson(res, LIST_ROUTE_KEY, 405, { ok: false, error: 'method not allowed' }, {
        state: 'error',
        reason: 'method_not_allowed'
      });
      return;
    }
    await handleList(req, res, context, deps);
  } catch (err) {
    logRouteError('admin.city_pack_feedback', err, context);
    writeJson(res, routeKey, 500, { ok: false, error: 'error' }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleCityPackFeedback
};
