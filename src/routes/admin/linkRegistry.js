'use strict';

const { createLink } = require('../../usecases/linkRegistry/createLink');
const { listLinks } = require('../../usecases/linkRegistry/listLinks');
const { updateLink } = require('../../usecases/linkRegistry/updateLink');
const { deleteLink } = require('../../usecases/linkRegistry/deleteLink');
const { checkLinkHealth } = require('../../usecases/linkRegistry/checkLinkHealth');

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('invalid json');
    return null;
  }
}

async function handleCreate(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const result = await createLink(payload);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, id: result.id }));
}

async function handleList(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const limit = url.searchParams.get('limit');
  const state = url.searchParams.get('state');
  const result = await listLinks({
    limit: limit ? Number(limit) : undefined,
    state: state || undefined
  });
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, items: result }));
}

async function handleUpdate(req, res, body, id) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const result = await updateLink(id, payload);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, id: result.id }));
}

async function handleDelete(req, res, id) {
  const result = await deleteLink(id);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, id: result.id }));
}

async function handleHealth(req, res, body, id) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const result = await checkLinkHealth(id, payload);
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, id: result.id }));
}

module.exports = {
  handleCreate,
  handleList,
  handleUpdate,
  handleDelete,
  handleHealth
};
