'use strict';

const { getOpsConsole } = require('../phase25/getOpsConsole');

const DEFAULT_MODEL = 'gpt-x';
const DEFAULT_TIMEOUT_MS = 2500;

const PROMPT = [
  'You are an ops assistant.',
  'Given the ops console snapshot, suggest next actions with rationale and risk.',
  'Rules:',
  '- Do NOT suggest actions outside allowedNextActions.',
  '- If readiness is NOT_READY, only suggest STOP_AND_ESCALATE.',
  '- Suggestions are advisory only.'
].join('\n');

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

function normalizeSuggestions(raw, allowedNextActions, readinessStatus) {
  const allowed = Array.isArray(allowedNextActions) ? allowedNextActions : [];
  const readiness = readinessStatus === 'READY' ? 'READY' : 'NOT_READY';
  const filtered = [];
  const list = Array.isArray(raw) ? raw : [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const action = typeof item.action === 'string' ? item.action : '';
    if (!action) continue;
    if (readiness !== 'READY' && action !== 'STOP_AND_ESCALATE') continue;
    if (allowed.length && !allowed.includes(action)) continue;
    const confidence = Number.isFinite(item.confidence) ? item.confidence : 0.5;
    filtered.push({
      action,
      confidence,
      rationale: typeof item.rationale === 'string' ? item.rationale : '',
      risk: typeof item.risk === 'string' ? item.risk : ''
    });
  }
  return filtered;
}

async function callAdapter(adapter, payload, timeoutMs) {
  if (!adapter || typeof adapter.suggestOpsDecision !== 'function') return null;
  const exec = adapter.suggestOpsDecision(payload);
  const limit = typeof timeoutMs === 'number' ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('llm timeout')), limit);
  });
  return Promise.race([exec, timeout]);
}

async function suggestOpsDecision(params, deps) {
  const payload = params || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');

  const consoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;
  const llmAdapter = deps && deps.llmAdapter ? deps.llmAdapter : null;
  const now = deps && typeof deps.nowFn === 'function' ? deps.nowFn() : new Date();
  const timeoutMs = deps && typeof deps.llmTimeoutMs === 'number' ? deps.llmTimeoutMs : DEFAULT_TIMEOUT_MS;

  const consoleResult = await consoleFn({ lineUserId }, deps);
  const readiness = consoleResult ? consoleResult.readiness : null;
  const allowedNextActions = consoleResult && Array.isArray(consoleResult.allowedNextActions)
    ? consoleResult.allowedNextActions
    : [];

  const snapshot = {
    readiness,
    userStateSummary: consoleResult ? consoleResult.userStateSummary : null,
    memberSummary: consoleResult ? consoleResult.memberSummary : null,
    latestDecisionLog: consoleResult ? consoleResult.latestDecisionLog : null,
    opsState: consoleResult ? consoleResult.opsState : null
  };

  let suggestedNextActions = [];
  let notes = [];
  let model = DEFAULT_MODEL;

  try {
    const adapterResult = await callAdapter(
      llmAdapter,
      { prompt: PROMPT, snapshot, allowedNextActions },
      timeoutMs
    );
    if (adapterResult) {
      suggestedNextActions = normalizeSuggestions(
        adapterResult.suggestedNextActions,
        allowedNextActions,
        readiness ? readiness.status : null
      );
      notes = Array.isArray(adapterResult.notes)
        ? adapterResult.notes.filter((note) => typeof note === 'string')
        : [];
      if (typeof adapterResult.model === 'string' && adapterResult.model.trim().length > 0) {
        model = adapterResult.model;
      }
    }
  } catch (err) {
    suggestedNextActions = [];
    notes = [];
    model = DEFAULT_MODEL;
  }

  return {
    ok: true,
    suggestedNextActions,
    notes,
    model,
    generatedAt: now.toISOString()
  };
}

module.exports = {
  suggestOpsDecision,
  PROMPT
};
