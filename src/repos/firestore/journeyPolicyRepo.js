'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'opsConfig';
const DOC_ID = 'journeyPolicy';

const DEFAULT_JOURNEY_POLICY = Object.freeze({
  enabled: false,
  reminder_offsets_days: [7, 3, 1],
  reminder_max_per_run: 200,
  paid_only_reminders: true,
  rich_menu_enabled: false,
  schedule_required_for_reminders: true,
  rich_menu_map: {
    free_default: '',
    pro_single: '',
    pro_couple: '',
    pro_accompany1: '',
    pro_accompany2: ''
  },
  auto_upgrade_message_enabled: true,
  auto_downgrade_message_enabled: true
});

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function normalizeNumber(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return Math.floor(num);
}

function normalizeOffsetDays(value, fallback) {
  const raw = value === null || value === undefined ? fallback : value;
  if (!Array.isArray(raw)) return null;
  const out = [];
  raw.forEach((item) => {
    const num = Number(item);
    if (!Number.isInteger(num)) return;
    if (num < 0 || num > 365) return;
    if (!out.includes(num)) out.push(num);
  });
  if (!out.length) return null;
  return out;
}

function normalizeString(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  return value.trim();
}

function normalizeRichMenuMap(value, fallback) {
  const raw = value === null || value === undefined ? fallback : value;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {
    free_default: normalizeString(raw.free_default, ''),
    pro_single: normalizeString(raw.pro_single, ''),
    pro_couple: normalizeString(raw.pro_couple, ''),
    pro_accompany1: normalizeString(raw.pro_accompany1, ''),
    pro_accompany2: normalizeString(raw.pro_accompany2, '')
  };
  if (Object.values(out).includes(null)) return null;
  return out;
}

function normalizeJourneyPolicy(input) {
  if (input === null || input === undefined) {
    return Object.assign({}, DEFAULT_JOURNEY_POLICY, {
      rich_menu_map: Object.assign({}, DEFAULT_JOURNEY_POLICY.rich_menu_map)
    });
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const enabled = normalizeBoolean(input.enabled, DEFAULT_JOURNEY_POLICY.enabled);
  const reminderOffsets = normalizeOffsetDays(input.reminder_offsets_days, DEFAULT_JOURNEY_POLICY.reminder_offsets_days);
  const reminderMaxPerRun = normalizeNumber(
    input.reminder_max_per_run,
    DEFAULT_JOURNEY_POLICY.reminder_max_per_run,
    1,
    5000
  );
  const paidOnlyReminders = normalizeBoolean(input.paid_only_reminders, DEFAULT_JOURNEY_POLICY.paid_only_reminders);
  const richMenuEnabled = normalizeBoolean(input.rich_menu_enabled, DEFAULT_JOURNEY_POLICY.rich_menu_enabled);
  const scheduleRequired = normalizeBoolean(
    input.schedule_required_for_reminders,
    DEFAULT_JOURNEY_POLICY.schedule_required_for_reminders
  );
  const richMenuMap = normalizeRichMenuMap(input.rich_menu_map, DEFAULT_JOURNEY_POLICY.rich_menu_map);
  const autoUpgrade = normalizeBoolean(
    input.auto_upgrade_message_enabled,
    DEFAULT_JOURNEY_POLICY.auto_upgrade_message_enabled
  );
  const autoDowngrade = normalizeBoolean(
    input.auto_downgrade_message_enabled,
    DEFAULT_JOURNEY_POLICY.auto_downgrade_message_enabled
  );

  if ([
    enabled,
    reminderOffsets,
    reminderMaxPerRun,
    paidOnlyReminders,
    richMenuEnabled,
    scheduleRequired,
    richMenuMap,
    autoUpgrade,
    autoDowngrade
  ].includes(null)) {
    return null;
  }

  return {
    enabled,
    reminder_offsets_days: reminderOffsets,
    reminder_max_per_run: reminderMaxPerRun,
    paid_only_reminders: paidOnlyReminders,
    rich_menu_enabled: richMenuEnabled,
    schedule_required_for_reminders: scheduleRequired,
    rich_menu_map: richMenuMap,
    auto_upgrade_message_enabled: autoUpgrade,
    auto_downgrade_message_enabled: autoDowngrade
  };
}

async function getJourneyPolicy() {
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) {
    return normalizeJourneyPolicy(null);
  }
  const data = snap.data() || {};
  const normalized = normalizeJourneyPolicy(data);
  if (!normalized) {
    return normalizeJourneyPolicy(null);
  }
  return Object.assign({}, normalized, {
    updatedAt: data.updatedAt || null,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null
  });
}

async function setJourneyPolicy(policy, actor) {
  const normalized = normalizeJourneyPolicy(policy);
  if (!normalized) throw new Error('invalid journeyPolicy');
  const updatedBy = typeof actor === 'string' && actor.trim() ? actor.trim() : 'unknown';
  const db = getDb();
  await db.collection(COLLECTION).doc(DOC_ID).set(Object.assign({}, normalized, {
    updatedAt: serverTimestamp(),
    updatedBy
  }), { merge: true });
  return getJourneyPolicy();
}

module.exports = {
  COLLECTION,
  DOC_ID,
  DEFAULT_JOURNEY_POLICY,
  normalizeJourneyPolicy,
  getJourneyPolicy,
  setJourneyPolicy
};
