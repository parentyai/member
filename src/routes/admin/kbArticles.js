'use strict';

const faqArticlesRepo = require('../../repos/firestore/faqArticlesRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { requireActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

const LIST_LIMIT = 50;
const ROUTE_TYPE = 'admin_route';
const LIST_ROUTE_KEY = 'admin.kb_articles_list';
const CREATE_ROUTE_KEY = 'admin.kb_articles_create';
const UPDATE_ROUTE_KEY = 'admin.kb_articles_update';
const DELETE_ROUTE_KEY = 'admin.kb_articles_delete';

function normalizeOutcomeOptions(routeKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = routeKey;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, routeKey, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(routeKey, outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function json200(res, routeKey, data) {
  writeJson(res, routeKey, 200, { ok: true, data }, {
    state: 'success',
    reason: 'completed'
  });
}

function json422(res, routeKey, errors) {
  writeJson(res, routeKey, 422, { ok: false, error: 'kb_schema_invalid', errors }, {
    state: 'error',
    reason: 'kb_schema_invalid'
  });
}

function json404(res, routeKey) {
  writeJson(res, routeKey, 404, { ok: false, error: 'not found' }, {
    state: 'error',
    reason: 'not_found'
  });
}

function json500(res, routeKey) {
  writeJson(res, routeKey, 500, { ok: false, error: 'error' }, {
    state: 'error',
    reason: 'error'
  });
}

async function handleList(req, res, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const searchActiveArticles = typeof resolvedDeps.searchActiveArticles === 'function'
    ? resolvedDeps.searchActiveArticles
    : faqArticlesRepo.searchActiveArticles;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  try {
    const articles = await searchActiveArticles({ query: '', limit: LIST_LIMIT });
    void appendAudit({
      actor,
      action: 'kb_articles.list',
      entityType: 'kb_articles',
      entityId: 'all',
      traceId,
      requestId,
      payloadSummary: { count: articles.length }
    }).catch(() => {});
    json200(res, LIST_ROUTE_KEY, articles);
  } catch (_err) {
    json500(res, LIST_ROUTE_KEY);
  }
}

async function handleCreate(req, res, bodyRaw, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const body = parseJson(bodyRaw, res);
  if (!body) return;
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const validateKbArticle = typeof resolvedDeps.validateKbArticle === 'function'
    ? resolvedDeps.validateKbArticle
    : faqArticlesRepo.validateKbArticle;
  const createArticle = typeof resolvedDeps.createArticle === 'function'
    ? resolvedDeps.createArticle
    : faqArticlesRepo.createArticle;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;

  const { valid, errors } = validateKbArticle(body);
  if (!valid) {
    void appendAudit({
      actor,
      action: 'kb_articles.create.rejected',
      entityType: 'kb_articles',
      entityId: 'new',
      traceId,
      requestId,
      payloadSummary: { errors }
    }).catch(() => {});
    return json422(res, CREATE_ROUTE_KEY, errors);
  }

  try {
    const result = await createArticle(body);
    void appendAudit({
      actor,
      action: 'kb_articles.create',
      entityType: 'kb_articles',
      entityId: result.id,
      traceId,
      requestId,
      payloadSummary: { id: result.id, status: body.status, riskLevel: body.riskLevel }
    }).catch(() => {});
    json200(res, CREATE_ROUTE_KEY, { id: result.id });
  } catch (err) {
    if (err && err.failureCode === 'kb_schema_invalid') {
      return json422(res, CREATE_ROUTE_KEY, err.errors || []);
    }
    json500(res, CREATE_ROUTE_KEY);
  }
}

async function handleUpdate(req, res, bodyRaw, articleId, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  if (!articleId) return json404(res, UPDATE_ROUTE_KEY);
  const body = parseJson(bodyRaw, res);
  if (!body) return;
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const updateArticle = typeof resolvedDeps.updateArticle === 'function'
    ? resolvedDeps.updateArticle
    : faqArticlesRepo.updateArticle;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;

  try {
    const result = await updateArticle(articleId, body);
    void appendAudit({
      actor,
      action: 'kb_articles.update',
      entityType: 'kb_articles',
      entityId: result.id,
      traceId,
      requestId,
      payloadSummary: { id: result.id, patchKeys: Object.keys(body) }
    }).catch(() => {});
    json200(res, UPDATE_ROUTE_KEY, { id: result.id });
  } catch (_err) {
    json500(res, UPDATE_ROUTE_KEY);
  }
}

async function handleDelete(req, res, articleId, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  if (!articleId) return json404(res, DELETE_ROUTE_KEY);
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const deleteArticle = typeof resolvedDeps.deleteArticle === 'function'
    ? resolvedDeps.deleteArticle
    : faqArticlesRepo.deleteArticle;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;

  try {
    const result = await deleteArticle(articleId);
    void appendAudit({
      actor,
      action: 'kb_articles.delete',
      entityType: 'kb_articles',
      entityId: result.id,
      traceId,
      requestId,
      payloadSummary: { id: result.id }
    }).catch(() => {});
    json200(res, DELETE_ROUTE_KEY, { id: result.id });
  } catch (_err) {
    json500(res, DELETE_ROUTE_KEY);
  }
}

module.exports = {
  handleList,
  handleCreate,
  handleUpdate,
  handleDelete
};
