'use strict';

const { getChecklistWithStatus } = require('../usecases/checklists/getChecklistWithStatus');
const { toggleChecklistItem } = require('../usecases/checklists/toggleChecklistItem');

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
  if (message.includes('required') || message.includes('not found')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handlePhase1Checklist(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  const step = url.searchParams.get('step');
  try {
    const result = await getChecklistWithStatus({ lineUserId, step });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, scenario: result.scenario, step: result.step, items: result.items }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handlePhase1ChecklistToggle(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await toggleChecklistItem({
      lineUserId: payload.lineUserId,
      checklistId: payload.checklistId,
      itemId: payload.itemId,
      complete: Boolean(payload.complete)
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, id: result.id, completedAt: result.completedAt }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handlePhase1Checklist,
  handlePhase1ChecklistToggle
};
