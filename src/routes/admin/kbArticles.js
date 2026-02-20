'use strict';

const faqArticlesRepo = require('../../repos/firestore/faqArticlesRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

const LIST_LIMIT = 50;

function json200(res, data) {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, data }));
}

function json422(res, errors) {
  res.writeHead(422, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'kb_schema_invalid', errors }));
}

function json404(res) {
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'not found' }));
}

function json500(res) {
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleList(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  try {
    const articles = await faqArticlesRepo.searchActiveArticles({ query: '', limit: LIST_LIMIT });
    void appendAuditLog({
      actor,
      action: 'kb_articles.list',
      entityType: 'kb_articles',
      entityId: 'all',
      traceId,
      requestId,
      payloadSummary: { count: articles.length }
    }).catch(() => {});
    json200(res, articles);
  } catch (_err) {
    json500(res);
  }
}

async function handleCreate(req, res, bodyRaw) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const body = parseJson(bodyRaw, res);
  if (!body) return;

  const { valid, errors } = faqArticlesRepo.validateKbArticle(body);
  if (!valid) {
    void appendAuditLog({
      actor,
      action: 'kb_articles.create.rejected',
      entityType: 'kb_articles',
      entityId: 'new',
      traceId,
      requestId,
      payloadSummary: { errors }
    }).catch(() => {});
    return json422(res, errors);
  }

  try {
    const result = await faqArticlesRepo.createArticle(body);
    void appendAuditLog({
      actor,
      action: 'kb_articles.create',
      entityType: 'kb_articles',
      entityId: result.id,
      traceId,
      requestId,
      payloadSummary: { id: result.id, status: body.status, riskLevel: body.riskLevel }
    }).catch(() => {});
    json200(res, { id: result.id });
  } catch (err) {
    if (err && err.failureCode === 'kb_schema_invalid') {
      return json422(res, err.errors || []);
    }
    json500(res);
  }
}

async function handleUpdate(req, res, bodyRaw, articleId) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  if (!articleId) return json404(res);
  const body = parseJson(bodyRaw, res);
  if (!body) return;

  try {
    const result = await faqArticlesRepo.updateArticle(articleId, body);
    void appendAuditLog({
      actor,
      action: 'kb_articles.update',
      entityType: 'kb_articles',
      entityId: result.id,
      traceId,
      requestId,
      payloadSummary: { id: result.id, patchKeys: Object.keys(body) }
    }).catch(() => {});
    json200(res, { id: result.id });
  } catch (_err) {
    json500(res);
  }
}

async function handleDelete(req, res, articleId) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  if (!articleId) return json404(res);

  try {
    const result = await faqArticlesRepo.deleteArticle(articleId);
    void appendAuditLog({
      actor,
      action: 'kb_articles.delete',
      entityType: 'kb_articles',
      entityId: result.id,
      traceId,
      requestId,
      payloadSummary: { id: result.id }
    }).catch(() => {});
    json200(res, { id: result.id });
  } catch (_err) {
    json500(res);
  }
}

module.exports = {
  handleList,
  handleCreate,
  handleUpdate,
  handleDelete
};
