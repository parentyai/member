'use strict';

const { parseJourneyPostbackData } = require('../../domain/journey/lineCommandParsers');
const { handleJourneyLineCommand } = require('./handleJourneyLineCommand');
const { buildTaskDetailSectionReply } = require('./taskDetailSectionReply');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const { isTaskDetailLineEnabled } = require('../../domain/tasks/featureFlags');

const HOUSEHOLD_TEXT = Object.freeze({
  single: '単身',
  couple: '夫婦',
  accompany1: '帯同1',
  accompany2: '帯同2'
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeOptionalToken(value) {
  const text = normalizeText(value);
  return text || null;
}

function buildTaskDetailAttribution(input) {
  const payload = input && typeof input === 'object' ? input : {};
  return {
    notificationId: normalizeOptionalToken(payload.notificationId),
    deliveryId: normalizeOptionalToken(payload.deliveryId),
    source: normalizeOptionalToken(payload.attributionSource) || normalizeOptionalToken(payload.source),
    traceId: normalizeOptionalToken(payload.attributionTraceId) || normalizeOptionalToken(payload.traceId),
    requestId: normalizeOptionalToken(payload.requestId)
  };
}

function buildTaskDetailAttributionKey(lineUserId, todoKey, attribution) {
  const user = normalizeText(lineUserId);
  const key = normalizeText(todoKey);
  const row = attribution && typeof attribution === 'object' ? attribution : {};
  if (normalizeText(row.deliveryId)) return `delivery:${normalizeText(row.deliveryId)}`;
  if (normalizeText(row.notificationId)) return `notification:${normalizeText(row.notificationId)}:${user}:${key}`;
  if (normalizeText(row.traceId)) return `trace:${normalizeText(row.traceId)}:${user}:${key}`;
  return `todo:${user}:${key}`;
}

async function appendJourneyEventBestEffort(event, deps) {
  const payload = event && typeof event === 'object' ? event : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const type = normalizeText(payload.type);
  if (!lineUserId || !type) return;
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repository = resolvedDeps.eventsRepo || eventsRepo;
  if (!repository || typeof repository.createEvent !== 'function') return;
  const extraFields = payload.fields && typeof payload.fields === 'object' ? payload.fields : {};
  await repository.createEvent(Object.assign({
    lineUserId,
    type,
    ref: payload.ref && typeof payload.ref === 'object' ? payload.ref : {}
  }, extraFields)).catch(() => null);
}

function toCommandText(action) {
  if (!action || typeof action !== 'object') return '';
  if (action.action === 'set_household') {
    return `属性:${HOUSEHOLD_TEXT[action.householdType] || action.householdType || ''}`;
  }
  if (action.action === 'set_departure_date') {
    return `渡航日:${action.departureDate || ''}`;
  }
  if (action.action === 'set_assignment_date') {
    return `着任日:${action.assignmentDate || ''}`;
  }
  if (action.action === 'todo_complete') {
    return `TODO完了:${action.todoKey || ''}`;
  }
  if (action.action === 'todo_in_progress') {
    return `TODO進行中:${action.todoKey || ''}`;
  }
  if (action.action === 'todo_not_started') {
    return `TODO未着手:${action.todoKey || ''}`;
  }
  if (action.action === 'todo_snooze') {
    if (action.snoozeUntil) return `TODOスヌーズ:${action.todoKey || ''}:${action.snoozeUntil}`;
    if (action.snoozeDays) return `TODOスヌーズ:${action.todoKey || ''}:${action.snoozeDays}`;
    return `TODOスヌーズ:${action.todoKey || ''}`;
  }
  if (action.action === 'todo_detail') {
    return `TODO詳細:${action.todoKey || ''}`;
  }
  if (action.action === 'todo_list') {
    return 'TODO一覧';
  }
  if (action.action === 'next_tasks') {
    return '今日の3つ';
  }
  if (action.action === 'category_view') {
    if (action.category) return `カテゴリ:${action.category}`;
    return 'カテゴリ';
  }
  if (action.action === 'category_view_missing') {
    return 'カテゴリ:INVALID';
  }
  if (action.action === 'delivery_history') {
    return '通知履歴';
  }
  if (action.action === 'support_guide') {
    return '相談';
  }
  if (action.action === 'todo_vendor') {
    return `TODO業者:${action.todoKey || ''}`;
  }
  if (action.action === 'todo_vendor_missing') {
    return 'TODO業者:';
  }
  if (action.action === 'city_pack_module_status') {
    return 'CityPack状況';
  }
  if (action.action === 'city_pack_module_subscribe') {
    return `CityPack購読:${action.module || ''}`;
  }
  if (action.action === 'city_pack_module_unsubscribe') {
    return `CityPack解除:${action.module || ''}`;
  }
  if (action.action === 'city_pack_module_subscribe_missing') {
    return 'CityPack購読:invalid';
  }
  if (action.action === 'city_pack_module_unsubscribe_missing') {
    return 'CityPack解除:invalid';
  }
  if (action.action === 'invalid_household') {
    return '属性:invalid';
  }
  if (action.action === 'invalid_departure_date') {
    return '渡航日:invalid';
  }
  if (action.action === 'invalid_assignment_date') {
    return '着任日:invalid';
  }
  return '';
}

async function handleTodoDetailSectionAction(lineUserId, action, context, deps) {
  if (!isTaskDetailLineEnabled()) {
    return {
      handled: true,
      replyText: 'タスク詳細表示は現在停止中です。'
    };
  }
  const todoKey = normalizeText(action && action.todoKey);
  const section = normalizeText(action && action.section).toLowerCase();
  const startChunk = Number(action && action.startChunk);
  const payload = context && typeof context === 'object' ? context : {};
  const attribution = buildTaskDetailAttribution(Object.assign({}, action || {}, payload || {}));
  const reply = await buildTaskDetailSectionReply({
    lineUserId,
    todoKey,
    section,
    startChunk: Number.isFinite(startChunk) ? startChunk : 1,
    attribution
  }, deps);
  const sectionMeta = reply && reply.sectionMeta && typeof reply.sectionMeta === 'object' ? reply.sectionMeta : null;
  if (reply && reply.handled === true && sectionMeta) {
    const eventType = Number(sectionMeta.startChunk) > 1 ? 'todo_detail_section_continue' : 'todo_detail_section_opened';
    await appendJourneyEventBestEffort({
      lineUserId,
      type: eventType,
      ref: {
        source: 'line_postback_todo_detail_section',
        todoKey,
        section: sectionMeta.section || section
      },
      fields: {
        sectionMeta,
        attribution,
        attributionKey: buildTaskDetailAttributionKey(lineUserId, todoKey, attribution)
      }
    }, deps);
  }
  return reply;
}

async function handleJourneyPostback(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const data = normalizeText(payload.data);
  if (!lineUserId || !data) return { handled: false };

  const action = parseJourneyPostbackData(data);
  if (!action) return { handled: false };

  if (action.action === 'todo_detail_section') {
    return handleTodoDetailSectionAction(lineUserId, action, payload, deps);
  }

  if (action.action === 'todo_detail') {
    return handleJourneyLineCommand({
      lineUserId,
      text: `TODO詳細:${action.todoKey || ''}`,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      attribution: buildTaskDetailAttribution(Object.assign({}, action || {}, payload || {}))
    }, deps);
  }

  const text = toCommandText(action);
  if (!text) return { handled: false };
  return handleJourneyLineCommand({
    lineUserId,
    text,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null
  }, deps);
}

module.exports = {
  handleJourneyPostback,
  handleTodoDetailSectionAction
};
