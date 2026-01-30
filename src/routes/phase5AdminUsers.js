'use strict';

const usersRepo = require('../repos/firestore/usersRepo');

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleUserReview(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  if (!payload.lineUserId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'lineUserId required' }));
    return;
  }
  const actorHeader = req && req.headers ? req.headers['x-actor'] : null;
  const actor = typeof actorHeader === 'string' && actorHeader.trim().length > 0
    ? actorHeader.trim()
    : 'unknown';
  try {
    await usersRepo.setOpsReview(payload.lineUserId, actor);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleUserReview
};
