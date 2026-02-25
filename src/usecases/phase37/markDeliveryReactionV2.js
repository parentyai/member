'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');

const ACTIONS = new Set(['open', 'save', 'snooze', 'none', 'redeem', 'response']);

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

function parseOptionalString(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function requireAction(action) {
  const normalized = parseOptionalString(action);
  if (!normalized) throw new Error('action required');
  const lowered = normalized.toLowerCase();
  if (!ACTIONS.has(lowered)) throw new Error('invalid action');
  return lowered;
}

function parseIso(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1000000000000 ? value : value * 1000).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  throw new Error('invalid at');
}

function parseOptionalIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1000000000000 ? value : value * 1000).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  throw new Error('invalid snoozeUntil');
}

function toJourneyState(action) {
  if (action === 'snooze') return 'snoozed';
  if (action === 'redeem') return 'done';
  if (action === 'none') return 'planned';
  if (action === 'open' || action === 'save' || action === 'response') return 'in_progress';
  return null;
}

async function updateTodoSignalIfExists(payload, deps) {
  const todoRepo = deps.journeyTodoItemsRepo || journeyTodoItemsRepo;
  const lineUserId = parseOptionalString(payload.lineUserId);
  const todoKey = parseOptionalString(payload.todoKey);
  if (!lineUserId || !todoKey) return { updated: false };

  const existing = await todoRepo.getJourneyTodoItem(lineUserId, todoKey);
  if (!existing) return { updated: false };

  const patch = {
    lastSignal: payload.action,
    stateUpdatedAt: payload.at,
    stateEvidenceRef: `delivery:${payload.deliveryId}`,
    source: 'phase37_delivery_reaction_v2'
  };
  if (payload.action === 'snooze') {
    patch.snoozeUntil = payload.snoozeUntil;
  }
  const journeyState = toJourneyState(payload.action);
  if (journeyState) patch.journeyState = journeyState;
  await todoRepo.upsertJourneyTodoItem(lineUserId, todoKey, patch);
  return { updated: true };
}

async function markDeliveryReactionV2(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const deliveryId = requireString(payload.deliveryId, 'deliveryId');
  const action = requireAction(payload.action);
  const at = parseIso(payload.at);
  const snoozeUntil = parseOptionalIso(payload.snoozeUntil);
  const responseText = parseOptionalString(payload.responseText);
  const traceId = parseOptionalString(payload.traceId);
  const requestId = parseOptionalString(payload.requestId);
  const actor = parseOptionalString(payload.actor) || 'phase37_delivery_reaction_v2';

  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const deliveries = resolvedDeps.deliveriesRepo || deliveriesRepo;
  const auditRepo = resolvedDeps.auditLogsRepo || auditLogsRepo;
  const events = resolvedDeps.eventsRepo || eventsRepo;

  const delivery = await deliveries.markReactionV2(deliveryId, action, {
    at,
    snoozeUntil,
    responseText,
    traceId
  });
  const lineUserId = parseOptionalString(payload.lineUserId) || parseOptionalString(delivery && delivery.lineUserId);
  const todoKey = parseOptionalString(payload.todoKey) || parseOptionalString(delivery && delivery.todoKey);

  await auditRepo.appendAuditLog({
    action: 'DELIVERY_REACTION_V2',
    eventType: 'DELIVERY_REACTION_V2',
    type: 'DELIVERY_REACTION_V2',
    deliveryId,
    reaction: action,
    lineUserId,
    todoKey,
    traceId,
    requestId,
    actor
  });

  if (lineUserId) {
    await events.createEvent({
      lineUserId,
      type: 'journey_reaction',
      deliveryId,
      todoKey: todoKey || null,
      reaction: action,
      traceId,
      requestId,
      actor,
      createdAt: at,
      responseText: action === 'response' ? responseText : null
    }).catch(() => null);
  }

  const todoUpdate = await updateTodoSignalIfExists({
    lineUserId,
    todoKey,
    action,
    at,
    deliveryId,
    snoozeUntil
  }, resolvedDeps).catch(() => ({ updated: false }));

  return {
    ok: true,
    deliveryId,
    action,
    lineUserId: lineUserId || null,
    todoKey: todoKey || null,
    todoUpdated: todoUpdate.updated === true
  };
}

module.exports = {
  markDeliveryReactionV2
};
