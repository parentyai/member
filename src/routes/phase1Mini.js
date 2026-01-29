'use strict';

const { getChecklistWithStatus } = require('../usecases/checklists/getChecklistWithStatus');
const { setChecklistItemDone } = require('../usecases/checklists/setChecklistItemDone');
const { getMemberProfile } = require('../usecases/users/getMemberProfile');
const { setMemberNumber } = require('../usecases/users/setMemberNumber');

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
    if (!payload.lineUserId || !payload.itemKey || typeof payload.done !== 'boolean') {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'lineUserId/itemKey/done required' }));
      return;
    }
    const result = await setChecklistItemDone({
      lineUserId: payload.lineUserId,
      itemKey: payload.itemKey,
      done: payload.done
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, itemKey: result.itemKey, done: result.done }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handlePhase1MemberGet(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  try {
    const profile = await getMemberProfile({ lineUserId });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, memberNumber: profile.memberNumber }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handlePhase1MemberUpdate(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await setMemberNumber({
      lineUserId: payload.lineUserId,
      memberNumber: payload.memberNumber
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, memberNumber: result.memberNumber }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handlePhase1Checklist,
  handlePhase1ChecklistToggle,
  handlePhase1MemberGet,
  handlePhase1MemberUpdate
};
