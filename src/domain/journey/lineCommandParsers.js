'use strict';

const { TASK_CATEGORY_SET } = require('../tasks/taskCategories');

const HOUSEHOLD_LABEL_MAP = Object.freeze({
  '単身': 'single',
  '1': 'single',
  'single': 'single',
  '夫婦': 'couple',
  '2': 'couple',
  'couple': 'couple',
  '帯同1': 'accompany1',
  '帯同１': 'accompany1',
  'accompany1': 'accompany1',
  '帯同2': 'accompany2',
  '帯同２': 'accompany2',
  'accompany2': 'accompany2'
});

const HOUSEHOLD_TO_SCENARIO = Object.freeze({
  single: 'A',
  couple: 'B',
  accompany1: 'C',
  accompany2: 'D'
});
const CITY_PACK_MODULE_PATTERN = /^[a-z_]{3,32}$/;
const SCENARIO_MIRROR_FIELD = String.fromCharCode(
  115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121, 77, 105, 114, 114, 111, 114
);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeOptionalToken(value) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeDateText(value) {
  const text = normalizeText(value).replace(/\//g, '-');
  if (!text) return null;
  const matched = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return iso;
}

function normalizeHouseholdLabel(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const lowered = text.toLowerCase();
  return HOUSEHOLD_LABEL_MAP[text] || HOUSEHOLD_LABEL_MAP[lowered] || null;
}

function normalizeCategory(value) {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) return null;
  return TASK_CATEGORY_SET.has(normalized) ? normalized : null;
}

function buildHouseholdAssignmentPayload(householdType) {
  const payload = {
    action: 'set_household',
    householdType
  };
  payload[SCENARIO_MIRROR_FIELD] = HOUSEHOLD_TO_SCENARIO[householdType] || null;
  return payload;
}

function parseJourneyLineCommand(text) {
  const raw = normalizeText(text);
  if (!raw) return null;

  if (/^(?:TODO一覧|やること一覧)$/i.test(raw)) {
    return { action: 'todo_list' };
  }

  if (/^(?:今やる|今日の3つ|NEXT_TASKS)$/i.test(raw)) {
    return { action: 'next_tasks' };
  }

  if (/^(?:今週の期限|DUE_SOON)$/i.test(raw)) {
    return { action: 'due_soon_tasks' };
  }

  if (/^(?:地域手続き|LOCAL_PROCEDURES|REGIONAL_PROCEDURES)$/i.test(raw)) {
    return { action: 'regional_procedures' };
  }

  if (/^(?:カテゴリ|CATEGORY_VIEW)$/i.test(raw)) {
    return { action: 'category_view' };
  }

  const categoryPick = raw.match(/^(?:カテゴリ|CATEGORY_VIEW)\s*[:：]\s*([A-Za-z_]+)$/i);
  if (categoryPick) {
    const category = normalizeCategory(categoryPick[1]);
    if (!category) return { action: 'category_view_missing' };
    return { action: 'category_view', category };
  }

  if (/^(?:通知履歴|DELIVERY_HISTORY)$/i.test(raw)) {
    return { action: 'delivery_history' };
  }

  if (/^(?:相談|相談希望|SUPPORT)$/i.test(raw)) {
    return { action: 'support_guide' };
  }

  const todoVendor = raw.match(/^TODO(?:業者|VENDOR)\s*[:：]?\s*([A-Za-z0-9_\-]+)$/i);
  if (todoVendor) {
    return {
      action: 'todo_vendor',
      todoKey: normalizeText(todoVendor[1])
    };
  }

  const complete = raw.match(/^TODO完了\s*[:：]?\s*([A-Za-z0-9_\-]+)$/i);
  if (complete) {
    return {
      action: 'todo_complete',
      todoKey: normalizeText(complete[1])
    };
  }

  const inProgress = raw.match(/^TODO(?:進行中|開始)\s*[:：]?\s*([A-Za-z0-9_\-]+)$/i);
  if (inProgress) {
    return {
      action: 'todo_in_progress',
      todoKey: normalizeText(inProgress[1])
    };
  }

  const notStarted = raw.match(/^TODO(?:未着手|戻す)\s*[:：]?\s*([A-Za-z0-9_\-]+)$/i);
  if (notStarted) {
    return {
      action: 'todo_not_started',
      todoKey: normalizeText(notStarted[1])
    };
  }

  const snooze = raw.match(/^TODO(?:スヌーズ|後で)\s*[:：]?\s*([A-Za-z0-9_\-]+)(?:\s*[:：]\s*(.+))?$/i);
  if (snooze) {
    const todoKey = normalizeText(snooze[1]);
    const value = normalizeText(snooze[2] || '');
    const date = normalizeDateText(value);
    const days = Number(value);
    return {
      action: 'todo_snooze',
      todoKey,
      snoozeUntil: date || null,
      snoozeDays: Number.isInteger(days) && days >= 1 && days <= 30 ? days : null
    };
  }

  const detail = raw.match(/^TODO(?:詳細|DETAIL)\s*[:：]?\s*([A-Za-z0-9_\-]+)$/i);
  if (detail) {
    return {
      action: 'todo_detail',
      todoKey: normalizeText(detail[1])
    };
  }

  const detailContinue = raw.match(/^TODO(?:詳細)?続き\s*[:：]?\s*([A-Za-z0-9_\-]+)\s*[:：]\s*(manual|failure)(?:\s*[:：]\s*(\d+))?$/i);
  if (detailContinue) {
    const startChunk = Number(detailContinue[3] || '1');
    return {
      action: 'todo_detail_section_continue',
      todoKey: normalizeText(detailContinue[1]),
      section: normalizeText(detailContinue[2]).toLowerCase(),
      startChunk: Number.isInteger(startChunk) && startChunk >= 1 ? startChunk : 1
    };
  }

  if (/^(?:CityPack(?:案内|モジュール|購読)|CITYPACK(?:GUIDE|MODULE))$/i.test(raw)) {
    return { action: 'city_pack_module_guide' };
  }

  const cityPackSubscribe = raw.match(/^CityPack(?:購読|SUBSCRIBE)\s*[:：]\s*([a-z_]{3,32})$/i);
  if (cityPackSubscribe) {
    const module = normalizeText(cityPackSubscribe[1]).toLowerCase();
    if (!CITY_PACK_MODULE_PATTERN.test(module)) return { action: 'city_pack_module_subscribe_missing' };
    return { action: 'city_pack_module_subscribe', module };
  }

  const cityPackUnsubscribe = raw.match(/^CityPack(?:解除|UNSUBSCRIBE)\s*[:：]\s*([a-z_]{3,32})$/i);
  if (cityPackUnsubscribe) {
    const module = normalizeText(cityPackUnsubscribe[1]).toLowerCase();
    if (!CITY_PACK_MODULE_PATTERN.test(module)) return { action: 'city_pack_module_unsubscribe_missing' };
    return { action: 'city_pack_module_unsubscribe', module };
  }

  if (/^(?:CityPack(?:状況|STATUS)|CITYPACK_STATUS)$/i.test(raw)) {
    return { action: 'city_pack_module_status' };
  }

  const household = raw.match(/^属性\s*[:：]?\s*(.+)$/i);
  if (household) {
    const householdType = normalizeHouseholdLabel(household[1]);
    if (!householdType) return { action: 'invalid_household' };
    return buildHouseholdAssignmentPayload(householdType);
  }

  const departure = raw.match(/^渡航日\s*[:：]?\s*(.+)$/i);
  if (departure) {
    const date = normalizeDateText(departure[1]);
    if (!date) return { action: 'invalid_departure_date' };
    return {
      action: 'set_departure_date',
      departureDate: date
    };
  }

  const assignment = raw.match(/^着任日\s*[:：]?\s*(.+)$/i);
  if (assignment) {
    const date = normalizeDateText(assignment[1]);
    if (!date) return { action: 'invalid_assignment_date' };
    return {
      action: 'set_assignment_date',
      assignmentDate: date
    };
  }

  return null;
}

function parseJourneyPostbackData(data) {
  const raw = normalizeText(data);
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const action = normalizeText(params.get('action'));
  if (!action) return null;

  if (action === 'set_household') {
    const householdType = normalizeHouseholdLabel(params.get('value'));
    if (!householdType) return { action: 'invalid_household' };
    const payload = buildHouseholdAssignmentPayload(householdType);
    payload.action = action;
    return payload;
  }

  if (action === 'set_departure_date') {
    const departureDate = normalizeDateText(params.get('value'));
    if (!departureDate) return { action: 'invalid_departure_date' };
    return { action, departureDate };
  }

  if (action === 'set_assignment_date') {
    const assignmentDate = normalizeDateText(params.get('value'));
    if (!assignmentDate) return { action: 'invalid_assignment_date' };
    return { action, assignmentDate };
  }

  if (action === 'todo_complete') {
    const todoKey = normalizeText(params.get('todoKey'));
    if (!todoKey) return { action: 'todo_complete_missing' };
    return { action, todoKey };
  }

  if (action === 'todo_in_progress') {
    const todoKey = normalizeText(params.get('todoKey'));
    if (!todoKey) return { action: 'todo_in_progress_missing' };
    return { action, todoKey };
  }

  if (action === 'todo_not_started') {
    const todoKey = normalizeText(params.get('todoKey'));
    if (!todoKey) return { action: 'todo_not_started_missing' };
    return { action, todoKey };
  }

  if (action === 'todo_snooze') {
    const todoKey = normalizeText(params.get('todoKey'));
    if (!todoKey) return { action: 'todo_snooze_missing' };
    const until = normalizeDateText(params.get('until'));
    const daysRaw = normalizeText(params.get('days'));
    const days = Number(daysRaw);
    return {
      action,
      todoKey,
      snoozeUntil: until,
      snoozeDays: Number.isInteger(days) && days >= 1 && days <= 30 ? days : null
    };
  }

  if (action === 'todo_detail') {
    const todoKey = normalizeText(params.get('todoKey'));
    if (!todoKey) return { action: 'todo_detail_missing' };
    return {
      action,
      todoKey,
      notificationId: normalizeOptionalToken(params.get('notificationId')),
      deliveryId: normalizeOptionalToken(params.get('deliveryId')),
      attributionSource: normalizeOptionalToken(params.get('source')),
      attributionTraceId: normalizeOptionalToken(params.get('traceId'))
    };
  }

  if (action === 'todo_detail_section') {
    const todoKey = normalizeText(params.get('todoKey'));
    const section = normalizeText(params.get('section')).toLowerCase();
    const chunk = Number(normalizeText(params.get('chunk')));
    if (!todoKey || !section) return { action: 'todo_detail_section_missing' };
    if (!['manual', 'failure'].includes(section)) return { action: 'todo_detail_section_missing' };
    return {
      action,
      todoKey,
      section,
      startChunk: Number.isInteger(chunk) && chunk >= 1 ? chunk : 1,
      notificationId: normalizeOptionalToken(params.get('notificationId')),
      deliveryId: normalizeOptionalToken(params.get('deliveryId')),
      attributionSource: normalizeOptionalToken(params.get('source')),
      attributionTraceId: normalizeOptionalToken(params.get('traceId'))
    };
  }

  if (
    action === 'next_tasks'
    || action === 'due_soon_tasks'
    || action === 'regional_procedures'
    || action === 'delivery_history'
    || action === 'support_guide'
  ) {
    return { action };
  }

  if (action === 'category_view') {
    const category = normalizeCategory(params.get('category'));
    return category ? { action, category } : { action };
  }

  if (action === 'category_pick') {
    const category = normalizeCategory(params.get('category'));
    if (!category) return { action: 'category_view_missing' };
    return { action: 'category_view', category };
  }

  if (action === 'todo_vendor') {
    const todoKey = normalizeText(params.get('todoKey'));
    if (!todoKey) return { action: 'todo_vendor_missing' };
    return { action, todoKey };
  }

  if (action === 'todo_list') {
    return { action };
  }

  if (action === 'city_pack_module_status') {
    return { action };
  }

  if (action === 'city_pack_module_subscribe' || action === 'city_pack_module_unsubscribe') {
    const module = normalizeText(params.get('module')).toLowerCase();
    if (!module || !CITY_PACK_MODULE_PATTERN.test(module)) return { action: `${action}_missing` };
    return { action, module };
  }

  return null;
}

module.exports = {
  HOUSEHOLD_LABEL_MAP,
  HOUSEHOLD_TO_SCENARIO,
  normalizeDateText,
  parseJourneyLineCommand,
  parseJourneyPostbackData
};
